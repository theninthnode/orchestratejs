var _ = require('lodash');

(function () {
	
    var error = null,
        queries = [],
        joins = [],
        results,
        config = {};

	var Orchestrate = function(config) {
		this.config = config;
        this.wheres = [];
        this.joins = [];
	};


    // check the config
    // check endpoints exist
    // set up each query
    // process results
    var buildQueries = function(global, callback) {
        
        config = global.config;

        var configError = checkConfig(config)

        if(configError !== false) {
            callback(configError);
        } else {

            // build main query
            // then loop joins

            queries = addQuery(global.getFrom(), global.getSelect(), global.getWhere(), global.getLimit(), global.getOrderBy().sortOn, global.getOrderBy().sortDir, global.getJoins());
            
            // console.log(queries);

            executeQuery(queries);
            
            callback(null, queries);
        }

    }

    var executeQuery = function(query) {
        
        var query_conf = _.find(config.endpoints, function(e) {
            return e.key === query.key;
        });

        console.log('Executing', query_conf.url);

        for (var i = query.joins.length - 1; i >= 0; i--) {
            executeQuery(query.joins[i]);
        };


    };

    var addQuery = function(key, select, where, limit, sortOn, sortDir, joins, populateAs) {

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
            obj.joins.push(addQuery(j[i].query.getFrom(), j[i].query.getSelect(), j[i].query.getWhere(), j[i].query.getLimit(), j[i].query.getOrderBy().sortOn, j[i].query.getOrderBy().sortDir, j[i].query.getJoins(), j[i].populateAs));
        };

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

    Orchestrate.prototype.setWhere = function(property, value) {
        
        this.wheres[property] = value;
            
        return this;

    };

    Orchestrate.prototype.getWhere = function() {
        return this.wheres;
    };    

    Orchestrate.prototype.setJoin = function(query, fromProperty, toProperty, populateAs) {
    	
        this.joins.push({
            query: query,
            fromProperty: fromProperty,
            toProperty: toProperty,
            populateAs: populateAs
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
            if(typeof callback === 'function') {
        		callback(err, results); // pass data
        	}

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
