## VatIRIS

[VatIRIS](https://vatiris.se/) is an interpretation of its real-world counterpart [IRIS](https://www.awos.se/sv-se/products/iris.aspx) - 
Integrated Real-time Information System, but adapted and extended for use by VATSIM controllers in Sweden.

### Manual

There is a manual available on the [VATSIM Scandinavia Wiki](https://wiki.vatsim-scandinavia.org/books/gen-k9C/page/vatiris) (requires being logged in with VATSIM account)

### Contributing

Contributions of any kind are most welcome.

- Please file bug reports and/or feature requests as [issues](https://github.com/minsulander/vatiris/issues).
- Pull requests are welcome.

### For developers

It's a fairly straight-forward [Vue3](https://vuejs.org) + [Vuetify](https://vuetifyjs.com) + [Winbox](https://nextapps-de.github.io/winbox/) + [Express](https://expressjs.com/) (for the backend) project.

To run the frontend:

```sh
cd frontend
npm install
npm start
```

To run the backend:

```sh
cd backend
npm install
npm start
```

A locally running backend will support logins through the [VATSIM Connect development environment](https://auth-dev.vatsim.net/). Apart from that, not all backend functionality will be available in a local development setting. To run the backend with full functionality, it's a bit more involved... You need:
- A local [postgresql](https://www.postgresql.org/) database server, with a database called `vatiris` initialized according to `backend/migrations/*.sql` files
- Environment variables `WIKI_TOKEN` and `WIKI_SECRET` for wiki access, available through the wiki [my account page](https://wiki.vatsim-scandinavia.org/my-account/auth)

