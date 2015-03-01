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

            // console.log(queries);

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

        // console.log(query_conf);
        
        // results undefined define array or object
        if(parentResults === null) {

            if(query_conf.isArray === true) {
                parentResults = [];
            } else {
                parentResults = {};
            }

        }

        // console.log('Parent results:', parentResults);

        var bindings = {};

        // process bindings
        if(typeof query.bind === 'function') {
            bindings = query.bind(parentResults);
        }


        // exchange placeholders (:city) with bindings
        for (var b in bindings) {
            if (bindings.hasOwnProperty(b)) {
                
                // binding undefined
                if(typeof bindings[b] === 'undefined') {
                    parentCallback('Binding error: could not bind ' + (query.populateAs || query.key ) + '. :' + b + ' was undefined.', null); return;
                }

                for(w in query.where) {
                    if (query.where.hasOwnProperty(w)) {
                        if(query.where[w] === (':'+b)){
                            // found match so replace and continue
                            query.where[w] = bindings[b];
                            continue;
                        };
                    }
                }
            }
        }

        // build url
        var query_string = serialize(query.where);
        var url = query_conf.url;

        // console.log(query_string);

        // execute url http request
        executeRequest(url, query_string, function(err, resp) {
    
            if(err) {
                parentCallback(err); return;
            }

            // get http request results and turn into json
            var res = JSON.parse(resp);

            // console.log(res);

            // does this enpoint return an array
            if(query_conf.isArray === true) {

                parentResults[query.populateAs || query.key] = [];

                async.each(res, function(r, outterCb) {
                        
                        // pick out the data we want
                        var _r = _.pick(r, query.select);
                        parentResults[query.populateAs || query.key].push(_r);
                        // console.log(_r);

                        // recursively execute joins
                        async.each(query.joins, function(join, cb) {
                            executeQuery(join, _r, cb);
                        }, function(e) { 
                            outterCb(e);  
                        });

                }, function(e) {
                    // console.log('Finished children of query:', url);
                    parentCallback(e);
                });                  
                
            }
            // single resource
            else {

                // pick out the data we want
                // console.log(query.select);
                var key = query.populateAs || query.key;
                if(typeof query.select !== 'undefined') {
                    
                    var _r = _.pick(res, query.select);
                    _r = _r[query.select];

                    parentResults[key] = _r;

                } else {
                    parentResults[key] = res;
                }
                // console.log('parentResults', parentResults);

                if(query.joins.length === 0) {
                    parentCallback(null, parentResults);                
                // process joins
                } else {

                    // recursively execute joins
                    async.each(query.joins, function(join, cb) {
                        executeQuery(join, parentResults, cb);
                    }, function(e) {
                        parentCallback(e, parentResults);
                    });
                    
                }


            }

        });
    };

    var executeRequest = function(url, query_string, callback) {
        
        var parts = urlParser.parse(url);

        var options = {
            host: parts.hostname,
            path: parts.pathname +  '?' + query_string
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

            if(typeof endpoint.url !== 'string') {
                throw new Error('Endpoint must have a string: url');
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

    var checkComplete = function() {
        return (registry.length === 0 && started === true);
    }


    // -------- Public API --------

	Orchestrate.prototype.setSelect = function() {
        
        this.select_statement = _.flatten(arguments);
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
