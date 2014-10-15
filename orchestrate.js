(function () {
	
	var Orchestrate = function(options) {
		this.options = options;
	};

	Orchestrate.prototype.select = function(string) {
		// body...
    	this.select_statement = string;
	};

    Orchestrate.prototype.from = function(endpoint) {
    	this.endpoint = endpoint;
    };

    Orchestrate.prototype.where = function(property, operand, value) {
        //
    };
    
    Orchestrate.prototype.join = function(entity, from_key, to_key) {
    	//
    };

    Orchestrate.prototype.orderBy = function(property, dircetion) {
    	//
    };

    Orchestrate.prototype.limit = function(limit) {
    	//
    };

    Orchestrate.prototype.get = function(callback) {
    	// do stuff
    	if(typeof callback === "function") {
    		callback(); // pass data
    	}
    };

    Orchestrate.prototype.count = function(callback) {
        // do stuff
        if(typeof callback === "function") {
            callback(); // pass data
        }
    };

    module.exports =  Orchestrate;

})();
