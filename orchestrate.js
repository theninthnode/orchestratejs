var _ = require('lodash'),
    http = require('http'),
    urlParser = require('url'),
    async = require('async');

(function () {
	
	var Orchestrate = function(config) {
		this.config = config;
        this.wheres = {};
        this.joins = [];
	};

    // check the config
    // check endpoints exist
    // set up each query
    // process results
    var buildQueries = function(global, topLevelCallback) {
        
        config = global.config;

        var configError = checkConfig(config)

        if(configError === false) {
            
            // build top level query
            // then inside recusively loop joined queries
            var queries = addQuery(global.getFrom(), global.getSelect(), global.getWhere(), global.getLimit(), global.getOrderBy().sortOn, global.getOrderBy().sortDir, global.getJoins());

            // console.log(queries); return;

            executeQuery(queries, null, topLevelCallback); // pass in empty results
            

        } else {
            topLevelCallback(configError);
        }

    }

    var executeQuery = function(query, parentResults, parentCallback) {
        
        // get config
        var query_conf = _.find(config.endpoints, function(e) {
            return e.key === query.key;
        });

        // console.log(query_conf); return;
        
        // results undefined define array or object
        if(parentResults === null) {

            if(query_conf.isArray === true) {
                parentResults = [];
            } else {
                parentResults = {};
            }

        }

        var bindings = {}, params = [];

        // process bindings
        if(typeof query.bind === 'function') {
            bindings = query.bind(parentResults);
        }

        // console.log(query.bind);

        // exchange placeholders (:placeholder) with bindings
        for (var b in bindings) {
            if (bindings.hasOwnProperty(b)) {
                
                // console.log('Binding', bindings[b]);

                // binding undefined
                if(typeof bindings[b] === 'undefined') {
                    parentCallback('Binding error: could not bind ' + (query.populateAs || query.key ) + '. :' + b + ' was undefined.', null); return;
                }

                for(w in query.where) {
                    if (query.where.hasOwnProperty(w)) {
                        // console.log('query.where', query.where[w]);
                        if(query.where[w] === (':'+b)){
                            // found match so replace and continue
                            params[w] = bindings[b];
                            continue;
                        };
                    }
                }
            }
        }

        if(_.size(bindings) === 0) {
            params = query.where;
        }

        // build url
        var query_string = serialize(params);
        var location = query_conf.location;

        console.log('location', location, query_string);
        // console.log('parent rea', parentResults);

        // execute url http request
        executeRequest(location, query_string, function(err, resp) {
    
            if(err) {
                parentCallback(err); return;
            }

            // get http request results and turn into json
            var res = JSON.parse(resp);
            // console.log(res);


            // does this enpoint return an array / TODO!
            if(query_conf.isArray === true) {

                // parentResults[query.populateAs || query.key] = [];

                async.eachSeries(res, function(r, outterCb) {
                        
                        attachData(query, r, parentResults, outterCb, true);
                        // console.log('After attach');

                }, function(e) {
                    console.log(parentResults);
                    console.log('Finished children of query:', location);
                    parentCallback(e);
                });                  
                
            }
            // single resource
            else {

                attachData(query, res, parentResults, parentCallback, false);
                console.log('After attach');

            }

        });
    };

    var attachData = function(query, res, parentResults, callback, isArray) {
        // pick out the data we want
        // console.log('res', res);
        console.log('Attaching',query.key);
        console.log('parentResults', parentResults);

        if(typeof query.select !== 'undefined') {
            
            console.log('SELECT', query.select);

            for (var i = query.select.length - 1; i >= 0; i--) {
                
                // console.log(query.select);
                var _r = selectRecursive(res, query.select[i]);

                if(_.size(parentResults) === 0) {
                    parentResults = _r;  
                } else {
                    // console.log(setToValue(query.select[i], _r, parentResults));
                    parentResults[(query.populateAs || query.select[i].split('.').pop())] = _r;
                }
                // console.log(parentResults);
            };
        
        // use key
        } else {
            if(_.size(parentResults) === 0) {
                if(isArray) {
                    parentResults = [res];
                } else {
                    parentResults = res;
                }
            } else {
                if(isArray) {
                    parentResults[query.key].push(res);
                } else {
                    parentResults[query.key] = res;
                }
            }
        }
        console.log('parentResults', parentResults);

        if(query.joins.length === 0) {
            callback(null, parentResults); return;               
        // process joins
        } else {

            // recursively execute joins
            async.each(query.joins, function(join, cb) {
                executeQuery(join, parentResults, cb);
            }, function(e) {
                callback(e, parentResults); return;
            });
            
        }

        // return;
    };

    var executeRequest = function(location, query_string, callback) {
        
        var parts = urlParser.parse(location);

        var options = {
            host: parts.hostname,
            path: parts.pathname +  '?' + query_string,
            port: parts.port
        };

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
        }

        http.request(options, cb).end();
    };

    var addQuery = function(key, select, where, limit, sortOn, sortDir, joins, bind, populateAs) {

        // query object
        var obj = {
            key: key
        };

        if(select) {
            obj.select = select;
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
            obj.joins.push(addQuery(j[i].query.getFrom(), j[i].query.getSelect(), j[i].query.getWhere(), j[i].query.getLimit(), j[i].query.getOrderBy().sortOn, j[i].query.getOrderBy().sortDir, j[i].query.getJoins(), j[i].bind, j[i].populateAs));
        };

        // if join
        if(bind) {
            obj.bind = bind;
        }

        // if join
        if(populateAs) {
            obj.populateAs = populateAs;
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

    }

    // change this to node err
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
    }

    var selectRecursive = function(obj, p) {
        var path = p.split('.');
        var o = _.pick(obj, path[0]);

        // console.log(o[path[0]]);

        if(path.length > 1) {
            var new_path = _.clone(path);
            new_path.shift();
            return selectRecursive(o[path[0]], new_path.join('.'));
        } else {
            return o[path[0]];
        }
    };

    var setToValue = function(path, value, root) {

        var segments = path.split('.'),
        cursor = root,
        segment,
        i;

        for (i = 0; i < segments.length - 1; ++i) {
            segment = segments[i];
            cursor[segment] = cursor[segment] || {};
        }
        // console.log(cursor);
        return cursor[segments[i]] = value;

    };

    var recursivelyAttach = function(path, attachTo, data, previous) {

        // TODO

        if(typeof _return === 'undefined') {
            _return = {}; 
        }

        var p = path.split('.');

        if(p.length === 1 && previous === 'undefined') {
            attachTo[p[0]] = data;
        } else if(p.length === 1 && previous !== 'undefined') {
            attachTo[previous][p[0]] = data;
        } else {
            var new_path = _.clone(p);
            new_path.shift();
            return recursivelyAttach(new_path.join('.'), attachTo, data, p[0]);
        }

        return attachTo;

    }

    // -------- Public API --------

	Orchestrate.prototype.setSelect = function(select) {
        this.select_statement = select;
        return this;

    };

    Orchestrate.prototype.getSelect = function() {
        return this.select_statement;
    };

    Orchestrate.prototype.setFrom = function(endpoint) {
    
    	this.from_endpoint = endpoint;
        return this;
    
    };

    Orchestrate.prototype.getFrom = function() {
        return this.from_endpoint;    
    };

    Orchestrate.prototype.addWhere = function(key, val) {
        
        this.wheres[key] = val;
            
        return this;

    };

    Orchestrate.prototype.getWhere = function() {
        return this.wheres;
    };    

    Orchestrate.prototype.addJoin = function(query, options) {
    	
        this.joins.push({
            query: query,
            method: options.method || 'waterfall',
            bind: options.bind || null, 
            populateAs: options.populateAs || null
        });

        return this;

    };

    Orchestrate.prototype.getJoins = function() {
        return this.joins;
    };

    Orchestrate.prototype.setOrderBy = function(property, direction) {
    	this.sortOn = property;
        this.sortDir = direction;
    };

    Orchestrate.prototype.getOrderBy = function() {
        return {
            sortOn: this.sortOn,
            sortDir: this.sortDir
        }
    };

    Orchestrate.prototype.setLimit = function(limit) {
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

    Orchestrate.prototype.count = function(callback) {

        // do stuff
        if(typeof callback === "function") {
            callback(); // pass data
        }

    };

    module.exports =  Orchestrate;

})();
