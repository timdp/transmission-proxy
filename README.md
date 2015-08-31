# Transmission Proxy

[![npm](https://img.shields.io/npm/v/transmission-proxy.svg)](https://www.npmjs.com/package/transmission-proxy) [![Dependencies](https://img.shields.io/david/timdp/transmission-proxy.svg)](https://david-dm.org/timdp/transmission-proxy) [![JavaScript Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

A simple proxy server for the Transmission RPC API.

The proxy only allows the `torrent-add` method. This makes it ideal for use with
external services that are only allowed to push new torrents to your daemon.
One example is [showRSS](http://showrss.info/).

The app comes ready for deployment on [Heroku](https://www.heroku.com/) as well
as [OpenShift](https://www.openshift.com/). However, being a standard
[node.js](http://nodejs.org/) app, it can be run pretty much anywhere.

## Configuration

In `config.json.example`, you will find a sample configuration to get you on
your way. Just copy it to `config.json` and paste in your configuration.

By default, the app's queue gets stored in memory. However, for improved
robustness and scalability, it can also store it in a relational database.
To enable this feature:

1. Create a [PostgreSQL](http://www.postgresql.org/) database with the
following schema:

    ```sql
    CREATE TABLE "queue" (
      "id" SERIAL PRIMARY KEY,
      "filename" TEXT NOT NULL,
      "time" TIMESTAMP WITH TIME ZONE NOT NULL
    );
    ```

2. Adapt `config.json` to connect to the database:

    ```json
    {
      "storage": {
        "type": "postgresql",
        "postgresql": {
          "database_url": "postgresql://USERNAME:PASSWORD@HOST:PORT"
        }
      }
    }
    ```

    If you use Heroku or OpenShift's native PostgreSQL support, the database
    URL will be automatically detected from the environment.

## API

API documentation is in the works. See `src/server.js` for example usage of the
`transmission-proxy` module.

## Author

[Tim De Pauw](https://tmdpw.eu/)

## License

MIT
