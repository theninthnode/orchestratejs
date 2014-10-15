// var request = require('superagent');
var expect = require('expect.js'),
	Orchestrate = require('../orchestrate.js'),
	q;

describe('Orchestrate', function(){

	beforeEach(function(){
		q = new Orchestrate({foo:"bar"});
	});

	it('should have set select statement', function(done){
  	
		q.select('*');

	  	expect(q.select_statement).to.equal('*');
	  	done();
	});

	it('should have set from endpoint', function(done){
  	
		q.from('customers');

	  	expect(q.endpoint).to.equal('customers');
	  	done();
	});

	it('should have set select AND from endpoint', function(done){
  	
		q.select('first_name');
		q.from('customers');

	  	expect(q.select_statement).to.equal('first_name');
	  	expect(q.endpoint).to.equal('customers');
	  	done();
	});

	it('should set multiple instances', function(done){
		
		var customers = new Orchestrate();
		var bookings = new Orchestrate();
		
		customers.select('firstname');
		bookings.select('start_time');

		expect(customers.select_statement).to.equal('firstname');
		expect(bookings.select_statement).to.equal('start_time');

		done();
	});

});