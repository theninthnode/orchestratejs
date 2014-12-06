var expect = require('expect.js'),
	Query = require('../orchestrate'),
	config,
	q;

describe('Orchestrate', function(){

	config = {
		endpoints: [{
			key: 'customers',
			url: '/api/customers',
			headers: [],
			map: {sort: 'sort', direction: 'direction', limit: 'limit', offset: 'offset'}
		},
		{
			key: 'bookings',
			url: '/api/bookings',
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
		
		q.setSelect('*').setFrom('customers').setJoin('bookings', '_id', 'customer_id');
		expect(q.getFrom()).to.equal('customers');
		expect(q.getJoins().length).to.equal(1);
		expect(q.getJoins()[0].key).to.equal('bookings');
		expect(q.getJoins()[0].fromProperty).to.equal('_id');
		expect(q.getJoins()[0].toProperty).to.equal('customer_id');

		done();
	});

	it('should return error as null', function(done){
		
		q.setSelect('firstname').setFrom('customers').setJoin('bookings', 'bookings.customer_id', 'customers._id', 'bookings').setWhere('customers._id', 123);

		q.setLimit(100);
		q.setOrderBy('lastname', 'desc');

		q.get(function(err, data){
			expect(err).to.equal(null);
			done();
		});
		
	});

});