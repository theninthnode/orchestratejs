var expect = require('expect.js'),
	Query = require('../orchestrate'),
	config,
	q;

describe('Orchestrate', function(){

	config = {
		endpoints: [{
			key: 'weather',
			url: 'http://api.openweathermap.org/data/2.5/weather'
		},
		{
			key: 'customers',
			url: '/api/customers',
			headers: [],
			map: {sort: 'sort', direction: 'direction', limit: 'limit', offset: 'offset'}
		},
		{
			key: 'customer_notes',
			url: '/api/customer_notes',
			headers: [],
			map: {sort: 'sort', direction: 'direction', limit: 'limit', offset: 'offset'}
		},
		{
			key: 'bookings',
			url: '/api/bookings',
			headers: [],
			map: {sort: 'sort', direction: 'direction', limit: 'limit', offset: 'offset'}
		},
		{
			key: 'booking_notes',
			url: '/api/booking_notes',
			headers: [],
			map: {sort: 'sort', direction: 'direction', limit: 'limit', offset: 'offset'}
		}]
	}

	beforeEach(function(){
		q = new Query(config);
	});

	it('should have set select statement', function(done){
  	
		q.setSelect('firstname');

	  	expect(q.getSelect()[0]).to.equal('firstname');
	  	done();
	});

	it('should have set from endpoint', function(done){
  	
		q.setFrom('customers');

	  	expect(q.getFrom()).to.equal('customers');
	  	done();
	});

	it('should have set select AND from endpoint', function(done){
  	
		q.setSelect('first_name');
		q.setFrom('customers');

	  	expect(q.getSelect()[0]).to.equal('first_name');
	  	expect(q.getFrom()).to.equal('customers');
	  	done();
	});

	it('should set multiple instances', function(done){
		
		var customers = new Query(config);
		var bookings = new Query(config);
		
		customers.setSelect('firstname');
		bookings.setSelect('start_time');

		expect(customers.getSelect()[0]).to.equal('firstname');
		expect(bookings.getSelect()[0]).to.equal('start_time');

		done();
	});

	it('should set order by', function(done){
		
		q.setOrderBy('lastname', 'asc');
		expect(q.getOrderBy().sortOn).to.equal('lastname');
		expect(q.getOrderBy().sortDir).to.equal('asc');
		done();
	});

	it('should set limit', function(done){
		
		q.setLimit(10);
		expect(q.getLimit()).to.equal(10);
		done();
	});

	it('should build join collection', function(done){
		
		j = new Query(config);
		j.setSelect('start_time').setFrom('bookings').setLimit(500);
		
		q.setFrom('customers').addJoin(j, {method: 'waterfall', populateAs: 'bookings'});

		expect(q.getFrom()).to.equal('customers');
		expect(q.getJoins().length).to.equal(1);
		expect(q.getJoins()[0].query.getFrom()).to.equal('bookings');
		expect(q.getJoins()[0].method).to.equal('waterfall');
		expect(q.getJoins()[0].bind).to.equal(null);
		expect(q.getJoins()[0].populateAs).to.equal('bookings');

		done();
	});

	it('should return queries', function(done){
		
		var weather = new Query(config).setFrom('weather');
		weather.setSelect('weather');
		weather.addWhere('q', ':city');

		var customers = new Query(config).setFrom('customers');

		customers.setSelect('firstname', 'lastname');
		customers.addJoin(weather, {method: 'waterfall', bind: function(customer){
			return {city: customer.city}; // maps to :city
		}, populateAs: 'weather'});

		customers.setLimit(100);
		customers.setOrderBy('lastname', 'desc');

		customers.get(function(err, data){
			expect(err).to.equal(null);
			// done();
		});
		
	});

});