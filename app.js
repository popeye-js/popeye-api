var bodyParser = require('body-parser');
var express = require('express');
var PirateBay = require('thepiratebay');

const TorrentNameParser = require('torrent-name-parse');
const parser = new TorrentNameParser();

var PORT = process.env.PORT || 7001;

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

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
    res.send({success: true});
    return;
  }
  res.send({success: false});
});

app.delete('/requests', (req, res, next) => {
  db.requests = [];
  res.send({success: true});
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
    cache.pb[q] = results;  // Update the cached entry.
    res.send(results);  // Send the JSON blob.
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

// Get the latest episode - Assumes top seeded torrent is the latest episode
app.get('/latestEpisode', (req, res, next) => {
  var show = req.query.show;

  var key = ('/latestEpisode/'+show);
  if ( key in cache.pb) {
    res.send(cache.pb[key]);
  }

  PirateBay.search(show, {}).then(results => {
    var name = results[0]['name'];

    var torrentData = parser.parse(name);
    torrentData['magnetLink']=results[0]['magnetLink'];

    cache.pb[key] = torrentData;  // Update the cached entry.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(torrentData);  // Send the JSON blob.
  }).catch(err => {
    if (!err || !err.message) {
      error = new Error('Unknown error occurred');
    }
    console.error(err);
    res.send({
      error: err.message
    })
  });

})

app.listen(PORT, () => {
  console.log('Listening on port %s', PORT);
});
