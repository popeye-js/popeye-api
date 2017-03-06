# popeye.js

REST API for [Popeye voice controls](https://popeye-js.github.io/).


## Local installation

First, clone this git repository:

```sh
git clone git@github.com:popeye-js/popeye-api.git
```

### [Heroku](https://heroku.com)

1. Create a [Heroku account](https://signup.heroku.com/), if you don't already have one.
2. Sign in to [Heroku Dashboard](https://dashboard.heroku.com/account).
3. Add your [SSH Keys](https://dashboard.heroku.com/account#ssh-keys) ([read this tutorial](https://devcenter.heroku.com/articles/keys)).
4. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) on your system. (For macOS using [Homebrew](https://brew.sh/), run `brew install heroku`.)
5. Run these commands using the `heroku` CLI to set up the Heroku integration:

    ```sh
    heroku login
    heroku git:remote -a popeye-api
    ```
6. To deploy to Heroku manually, run `git push heroku master`. (The app will be automatically deployed to Heroku upon pushing to the upstream repository on GitHub, but you can still always trigger deploys manually.)

### Node

To install the [Node](https://nodejs.org/) dependencies:

```sh
npm install
```


## Local development

To start the local development server:

```sh
npm start
```


## Deployment

To deploy the app to the [Heroku production instance](https://popeye-api.herokuapp.com/):

```sh
npm run deploy
```


## License

[MIT](LICENSE.md)
