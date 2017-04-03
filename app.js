const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const PirateBay = require('thepiratebay');

const request = require('request');
const reqPromise = require('request-promise-native');

const imdb = require('imdb-api');

const PORT = process.env.PORT || 7001;

const app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(cors());  // Enabled CORS headers for responses for all routes.

app.get('*', (req, res, next) => {
  console.log('[GET]', req.url, req.body, req.query);
  next();
});

app.post('*', (req, res, next) => {
  console.log('[POST]', req.url, req.body, req.query);
  next();
});

const cache = {
  pb: {}
};

const db = {
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
  const q = req.query.q;

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
      err = new Error('Unknown error occurred');
    }
    console.error(err);
    res.send({
      error: err.message
    });
  });
});

app.get('/movie', (req, res, next) => {
  const name = req.query.name;

  const key = '/movie/' + name;
  if (key in cache.pb) {
    res.send(cache.pb[key]);
  }

  imdb.get(name).then(data => {
    const url = 'https://tv-v2.api-fetch.website/movie/' + data.imdbid;
    request(url, (err, response, body) => {
      if (err) {
        throw err;
      }

      body = JSON.parse(body);

      const magnetLink = body.torrents.en['720p'].url;

      var torrentData = {
        magnetLink: magnetLink
      };

      cache.pb[key] = torrentData;  // Update the cached entry.
      res.send(torrentData);  // Send the JSON blob.
    });
  }).catch(err => {
    if (!err || !err.message) {
      err = new Error('Unknown error occurred while fetching movie');
    }
    console.error(err);
    res.send({
      error: err.message
    });
  });
});

// Get the latest episode
app.get('/latestEpisode', (req, res, next) => {
  const show = req.query.show;

  var key = '/latestEpisode/' + show;
  var isCached = false;
  if (key in cache.pb) {
    isCached = true;
    res.json(cache.pb[key]);
  }

  var torrentData = {};
  var loadShow = show => {
    return imdb.get(show).then(data => {
      torrentData.title = data.title;
      torrentData.runtime = data.runtime;
      torrentData.poster = data.poster;
      return data.imdbid;
    });
  };

  var url = 'https://tv-v2.api-fetch.website/show/';
  var loadEpisode = imbdid => {
    url += imbdid;
    return reqPromise(url).then(data => {
      var body = JSON.parse(data);

      // Get episodes of the current or latest season.
      var num_seasons = body.num_seasons;
      var currSeason = [];
      body.episodes.forEach(episode => {
        if (episode.season === num_seasons) {
          currSeason.push(episode);
        }
      });

      // Find the latest episode.
      var highestEp = 0;
      var index = 0;
      for (var i = 0; i < currSeason.length; i++) {
        if (currSeason[i].episode > highestEp) {
          highestEp = currSeason[i].episode;
          index = i;
        }
      }

      var latestEp = currSeason[index];
      torrentData.magnetLink = latestEp.torrents['0'].url;
      var airedDate = new Date();
      airedDate.setTime(latestEp.first_aired * 1000);
      torrentData.first_aired = airedDate.toDateString();
      torrentData.overview = latestEp.overview;
      torrentData.ep_title = latestEp.title;
      torrentData.episode = latestEp.episode;
      torrentData.season = latestEp.season;

      return body;
    });
  };

  var reportProblems = err => {
    console.error(err);
    res.status(404).json({
      error: err
    });
  };

  loadShow(show).then(loadEpisode).then(body => {
    cache.pb[key] = torrentData;  // Update the cached entry.
    // Can't send data twice.
    if (!isCached) {
      res.json(torrentData);  // Send the JSON blob.
    }
  }).catch(reportProblems);
});

var putioURIs = {
  redirect: 'https://popeye-api.herokuapp.com/putio/authenticate/redirect',
  access_token: 'https://api.put.io/v2/oauth2/access_token'
};

var appURIs = {
  main: 'http://localhost:7000'
};

app.get('/putio/authenticate', (req, res, next) => {
  const client_id = '2801';
  const response_type = 'code';

  const authenticateURL = `https://api.put.io/v2/oauth2/authenticate?client_id=${client_id}&response_type=${response_type}&redirect_uri=${putioURIs.redirect}`;
  res.redirect(authenticateURL);
});

app.get('/putio/authenticate/redirect', (req, res, next) => {
  const options = {
    uri: putioURIs.access_token,
    qs: {
      client_id: '2801',
      client_secret: 'RNBYMVGCQE357PWIHN33',
      grant_type: 'authorization_code',
      // The URI must match the registered URI in put.io.
      redirect_uri: putioURIs.redirect,
      code: req.query.code
    },
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true  // Automatically parses the JSON string in the response.
  };

  reqPromise(options)
    .then(result => {
      // Consider CSRF-related middleware for express.
      res.cookie('access_token', result.access_token);
      res.redirect(appURIs.main);
    })
    .catch(err => {
      // API call failed.
      console.error(err);
    });
});

app.listen(PORT, () => {
  console.log('Listening on port %s', PORT);
});
