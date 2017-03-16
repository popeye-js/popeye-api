var bodyParser = require('body-parser');
var express = require('express');
var cors = require("cors");
var PirateBay = require('thepiratebay');

var request = require('request');
var reqPromise = require('request-promise-native');

const imdb = require('imdb-api');

var PORT = process.env.PORT || 7001;

var app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(cors()); // cors enablement for all routes

app.get('*', (req, res, next) => {
  console.log('[GET]', req.url, req.body, req.query);
  next();
});

app.post('*', (req, res, next) => {
  console.log('[POST]', req.url, req.body, req.query);
  next();
});

var cache = {
  pb: {}
};

var db = {
  requests: []
};

app.get('/', (req, res, next) => {
  res.send({
    status: 'ok'
  });
});

app.get('/requests', (req, res, next) => {
  res.send(db.requests);

});

app.post('/requests', (req, res, next) => {
  if (req.body) {
    db.requests.push(req.body);
    res.send({
      success: true
    });
    return;
  }
  res.send({
    success: false
  });
});

app.delete('/requests', (req, res, next) => {
  db.requests = [];
  res.send({
    success: true
  });
});

app.get('/torrents', (req, res, next) => {
  // Get the `q` query-string parameter from the URL (e.g., `/torrents?q=big+buck+bunny`).
  var q = req.query.q;

  if (q in cache.pb) {
    // If we found a cached JSON blob for the search term, then
    // immediately send the response, but still run the search query
    // asynchronously in the background to update the cache for
    // subsequent requests.
    res.send(cache.pb[q]);
  }

  PirateBay.search(q, {}).then(results => {
    cache.pb[q] = results; // Update the cached entry.
    res.send(results); // Send the JSON blob.
  }).catch(err => {
    if (!err || !err.message) {
      error = new Error('Unknown error occurred');
    }
    console.error(err);
    res.send({
      error: err.message
    })
  });
});

app.get('/movie', (req, res, next) => {
  var name = req.query.name;

  var key = '/movie/' + name;
  if (key in cache.pb) {
    res.send(cache.pb[key]);
  };

  imdb.get(name).then(function(data) {

    var url = "https://tv-v2.api-fetch.website/movie/" + data.imdbid;
    request(url, function(error, response, body) {

      body = JSON.parse(body);

      var magnetLink = body.torrents.en['720p']['url'];

      var torrentData = {};
      torrentData['magnetLink'] = magnetLink;

      cache.pb[key] = torrentData; // Update the cached entry.
      res.send(torrentData); // Send the JSON blob.
    });

  }).catch(err => {
    if (!err || !err.message) {
      error = new Error('Unknown error occurred while fetching movie');
    }
    console.error(err);
    res.send({
      error: err.message
    });
  });
});

// Get the latest episode
app.get('/latestEpisode', (req, res, next) => {
  var show = req.query.show;

  var key = ('/latestEpisode/' + show);
  var isCached = false;
  if (key in cache.pb) {
    isCached = true;
    res.json(cache.pb[key]);
  }

  var torrentData = {};
  var loadShow = function(show) {
    return imdb.get(show).then(function(data) {
      torrentData['title'] = data['title'];
      torrentData['runtime'] = data['runtime'];
      torrentData['poster'] = data['poster'];
      return data['imdbid'];
    });
  };

  var url = 'https://tv-v2.api-fetch.website/show/';
  var loadEpisode = function(imbdid) {
    url = url + imbdid;
    return reqPromise(url).then(function(data) {
      body = JSON.parse(data);

      // get episodes of the current or latest season.
      var num_seasons = body.num_seasons;
      var currSeason = [];
      body.episodes.forEach(function(episode) {
        if (episode.season == num_seasons) {
          currSeason.push(episode);
        }
      });

      // find the latest episode
      var highestEp = 0;
      var index = 0;
      for (var i = 0; i < currSeason.length; i++) {
        if (currSeason[i]['episode'] > highestEp) {
          highestEp = currSeason[i]['episode'];
          index = i;
        }
      }

      var latestEp = currSeason[index];
      torrentData['magnetLink'] = latestEp.torrents['0']['url'];
      var airedDate = new Date();
      airedDate.setTime(latestEp['first_aired'] * 1000);
      torrentData['first_aired'] = airedDate.toDateString();
      torrentData['overview'] = latestEp['overview'];
      torrentData['ep_title'] = latestEp['title'];
      torrentData['episode'] = latestEp['episode'];
      torrentData['season'] = latestEp['season'];

      return body;
    });
  }

  reportProblems = function(fault) {
    console.error(fault);
    res.status(404).json({
      error: fault
    });
  };

  loadShow(show).then(loadEpisode).then(function(body) {
    cache.pb[key] = torrentData; // Update the cached entry.
    // Can't send data twice
    if (!isCached) {
      res.json(torrentData); // Send the JSON blob.
    }
  }).catch(reportProblems);

})

app.listen(PORT, () => {
  console.log('Listening on port %s', PORT);
});
