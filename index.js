var Query = require('./orchestrate');

var config = {
	endpoints: [{
		key: 'weather',
		url: 'http://api.openweathermap.org/data/2.5/weather'
	},
	{
		key: 'customers',
		url: 'http://respondto.it/customers.json',
		headers: [],
		map: {sort: 'sort', direction: 'direction', limit: 'limit', offset: 'offset'},
		isArray: true
	}],
	cache: {}
}

var weather = new Query(config).setFrom('weather');
// weather.setSelect('weather');
weather.addWhere('q', 'new york');

var weather2 = new Query(config).setFrom('weather');
weather2.setSelect('weather');
weather2.addWhere('q', ':city');
weather.addJoin(weather2, {bind: function(weather){
	return {city: weather.weather.name}; // maps to :city
}, populateAs: 'weather2'});

weather.get(function(err, data) {
	if(err) {
		console.log(err);
	} else {
		console.log(data);
	}
});