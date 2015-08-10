/*jshint maxstatements:15, maxdepth:3, maxcomplexity:5 */

var _ = require('lodash'),
    http = require('http'),
    https = require('https'),
    urlParser = require('url'),
    async = require('async'),
    longjohn = require('longjohn');

(function () {
	
	var Orchestrate = function(config) {
		this.config = config;
        this.wheres = {};
        this.joins = [];
	};

    // var parentResults = null;

    // check the config
    // check endpoints exist
    // set up each query
    // process results
    var buildQueries = function(global, topLevelCallback) {
        
        config = global.config;

        var configError = checkConfig(config);

        if(configError === false) {
            
            // build top level query
            // then inside recusively loop joined queries
            var queries = addQuery(global.getFrom(), global.getSubdoc(), global.getSelect(), global.getWhere(), global.getLimit(), global.getOrderBy().sortOn, global.getOrderBy().sortDir, global.getJoins());

            executeQuery(queries, null, function(e,d) {
                topLevelCallback(e, d[queries.key]); // pass back first item
            }); // pass in public callback

        } else {
            topLevelCallback(configError);
        }

    };

    var executeQuery = function(query, parentResults, parentCallback) {
        
        // get config
        var query_conf = _.find(config.endpoints, function(e) {
            return e.key === query.key;
        });
        
        // results undefined define array or object
        if(parentResults === null) {
            parentResults = {};
        }

        var bindings = {}, params = [];

        // process bindings
        if(typeof query.bind === 'function') {
            bindings = query.bind(parentResults);
        }

        // console.log('Parent REsults: ', parentResults);

        // exchange placeholders (:placeholder) with bindings
        for (var b in bindings) {
            
            if (bindings.hasOwnProperty(b) && typeof bindings[b] !== 'undefined') {
                
                for (var w in query.where) {

                    if (query.where.hasOwnProperty(w) && query.where[w] === (':'+b)) {
                        // found match so update params and continue
                        params[w] = bindings[b];
                        continue;
                    }

                }

            } else {
                parentCallback('Binding error: could not bind ' + (query.decorateAs || query.key ) + '. :' + b + ' was undefined.', null); return;
            }

        }

        if(_.size(bindings) === 0) {
            params = query.where;
        }

        // build url
        var query_string = serialize(params);
        var location = query_conf.location;

        // console.log('location', location, query_string);

        // execute url http request
        executeRequest(location, query_conf, query_string, function(err, resp) {
    
            if(err) {
                parentCallback(err); return;
            }

            // get http request results and turn into json
            var res = JSON.parse(resp);

            if(query_conf.isArray === true) {
            
                var data = res;

                // if we need to select a subdocument do it now
                if(typeof query.subdocument !== 'undefined') {
                    data = selectRecursive(res, query.subdocument);
                }

                // force to an array (could be object)
                var arr = _.values(data);

                async.concat(arr, function(single, outterCb) {
                        
                        // console.log('SINGLE', single);
                        attachData(query, single, outterCb);

                }, function(e, d) {

                    if(typeof e !== 'undefined') {
                        parentCallback(e);
                    }

                    // only take first element and attach as object
                    if(typeof query.limit !== 'undefined' && query.limit === 1) {
                        parentResults[d[0].key] = d[0].data;
                    // take limit of all as array
                    } else {

                        var length = (typeof query.limit !== 'undefined' && query.limit <= d.length) ? query.limit : d.length;

                        // for each query
                        for (var i = length - 1; i >= 0; i--) {
                            
                            // if key not defined, set to array
                            if(typeof parentResults[d[i].key] === 'undefined') {
                                parentResults[d[i].key] = [];
                            }

                            parentResults[d[i].key].push(d[i].data);
                        }

                    }

                    // console.log('parentResultsArray', d);

                    console.log('Finished children of query:', location);
                    parentCallback(e, parentResults);
                
                });                  
                
            }
            // single resource
            else {

                attachData(query, res, function(e, d) {
                    parentResults[d.key] = d.data;
                    console.log('Finished children of query:', location);
                    parentCallback(e, parentResults);
                });

            }

        });
    };

    var buildKey = function(query) {
        var key;
        if(typeof query.decorateAs !== 'undefined') {
            key = query.decorateAs;
        } else if(query.key) {
            key = query.key;
        } else if (query.select) {
            key = query.select;
        }
        return key;
    };

    // takes query info, data, and a callback
    // passes back key to attach on and processde data
    var attachData = function(query, res, callback) {
        
        // console.log('Res:', res);

        // build key
        var key = buildKey(query);

        if(query.select) {

            // TODO select multiple
            res = selectRecursive(res, query.select);

        }

        // no joins
        if(query.joins.length === 0) {

            callback(null, {key: key, data: res}); return;               

        // process joins
        } else {

            // recursively execute joins
            async.concat(query.joins, function(join, cb) {
                executeQuery(join, res, cb);
            }, function(e, d) {
                // console.log('Join data', d);
                console.log('Finished joins');
                callback(e, {key: key, data: d[0]}); return;
            });
            
        }

        return;
    };

    var isAuthTypeBasic = function(query) {
        return (typeof query.auth !== 'undefined' && typeof query.auth.method !== 'undefined' && query.auth.method === 'basic');
    };

    var executeRequest = function(location, query_conf, query_string, callback) {
        
        var parts = urlParser.parse(location);

        var options = {
            host: parts.hostname,
            path: parts.pathname +  '?' + query_string,
            port: parts.port || (parts.protocol === 'https:' ? 443 : 80),
            agent: false
        };

        // auth type Basic - attach header
        if(isAuthTypeBasic(query_conf)) {
            var auth = 'Basic ' + new Buffer(query_conf.auth.username + ':' + query_conf.auth.password).toString('base64');
            query_conf.headers['Authorization'] = auth;
        }

        if(typeof query_conf.headers !== 'undefined') {
            options.headers = query_conf.headers;
        }

        var cb = function(response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we pass it back here
            response.on('end', function () {

                callback(null, str);
            });

            response.on('error', function (e) {
                callback(e);
            });
        };

        var schema = (parts.protocol === 'https:' ? https : http);

        schema.request(options, cb).on('error', function (e) {
            callback(e);
        }).end();
    };

    var addQuery = function(key, sub, select, where, limit, sortOn, sortDir, joins, bind, decorateAs) {

        // query object
        var obj = {
            key: key
        };

        if(select) {
            obj.select = select;
        }

        if(sub) {
            obj.subdocument = sub;
        }

        if(where) {
            obj.where = where;
        }

        if(limit) {
            obj.limit = limit;
        }

        if(sortOn) {
            obj.sortOn = sortOn;
        }

        if(sortDir) {
            obj.sortDir = sortDir;
        }

        var j = joins || [];
        obj.joins = [];

        for (var i = j.length - 1; i >= 0; i--) {
            obj.joins.push(addQuery(j[i].query.getFrom(), j[i].query.getSubdoc(), j[i].query.getSelect(), j[i].query.getWhere(), j[i].query.getLimit(), j[i].query.getOrderBy().sortOn, j[i].query.getOrderBy().sortDir, j[i].query.getJoins(), j[i].bind, j[i].decorateAs));
        }

        // if join
        if(bind) {
            obj.bind = bind;
        }

        // if join
        if(decorateAs) {
            obj.decorateAs = decorateAs;
        }

        return obj;
    };

    var checkConfig = function(conf) {

        var error = false;

        if(typeof conf === 'undefined') {
            // does it exist
            error = 'config must be passed to constructor';
        } else if(typeof conf !== "object") {
            // is it an object?
            error = 'config must be an object';
        }

        return error;

    };

    // TODO implement and change this to node err
    var checkEndpoints = function(endpoints) {

        endpoints.forEach(function(endpoint){
            
            if(typeof endpoint.key !== 'string') {
                throw new Error('Endpoint must have a string: key');
            }

            if(typeof endpoint.location !== 'string') {
                throw new Error('Endpoint must have a string: location');
            }

            if(typeof endpoint.headers !== 'undefined' && typeof endpoint.headers !== 'object') {
                throw new Error('headers must be supplied as an array');
            }

            if(typeof endpoint.map !== 'undefined' && typeof endpoint.map !== 'object') {
                throw new Error('map must be supplied as an object');
            }

        });

    };

    // TODO implement and change to node error
    var checkEndpointExists = function(endpoints, key) {
        
        var find = _.findWhere(endpoints, {key: key});

        if(typeof find === 'undefined') {
            throw new Error('Key mismatch: ' + key);
        }

    };

    // http://stackoverflow.com/questions/1714786/querystring-encoding-of-a-javascript-object
    var serialize = function(obj, prefix) {
        var str = [];
        for(var p in obj) {
            if (obj.hasOwnProperty(p)) {
                var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
                str.push(typeof v == "object" ?
                serialize(v, k) :
                encodeURIComponent(k) + "=" + encodeURIComponent(v));
            }
        }
        return str.join("&");
    };

    var selectRecursive = function(obj, p) {
        var path = p.split('.');
        var o = _.pick(obj, path[0]);

        if(path.length > 1) {
            var new_path = _.clone(path);
            new_path.shift();
            return selectRecursive(o[path[0]], new_path.join('.'));
        } else {
            return o[path[0]];
        }
    };

    // -------- Public API --------

	Orchestrate.prototype.select = function(select) {
        this.select_statement = select;
        return this;

    };

    Orchestrate.prototype.getSelect = function() {
        return this.select_statement;
    };

    Orchestrate.prototype.subdoc = function(sub) {
        this.subdocument = sub;
        return this;

    };

    Orchestrate.prototype.getSubdoc = function() {
        return this.subdocument;
    };

    Orchestrate.prototype.from = function(endpoint) {
    
    	this.from_endpoint = endpoint;
        return this;
    
    };

    Orchestrate.prototype.getFrom = function() {
        return this.from_endpoint;    
    };

    Orchestrate.prototype.where = function(key, val) {
        
        this.wheres[key] = val;
            
        return this;

    };

    Orchestrate.prototype.getWhere = function() {
        return this.wheres;
    };    

    Orchestrate.prototype.decorate = function(name, query, bind) {
    	
        this.joins.push({
            query: query,
            // method: options.method || 'waterfall',
            bind: bind || null, 
            decorateAs: name
        });

        return this;

    };

    Orchestrate.prototype.getJoins = function() {
        return this.joins;
    };

    Orchestrate.prototype.orderBy = function(property, direction) {
    	this.sortOn = property;
        this.sortDir = direction;
    };

    Orchestrate.prototype.getOrderBy = function() {
        return {
            sortOn: this.sortOn,
            sortDir: this.sortDir
        };
    };

    Orchestrate.prototype.take = function(limit) {
    	this.limit = limit;
    };

    Orchestrate.prototype.getLimit = function() {
        return this.limit;
    };

    Orchestrate.prototype.get = function(callback) {

        buildQueries(this, function(err, results) {
            callback(err, results);
        });

    };

    module.exports =  Orchestrate;

})();
