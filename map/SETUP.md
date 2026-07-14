# Dig map: server setup notes (Ubuntu Lightsail, plain Apache)

Architecture: everything static except two small backend services. The map
page, tiles, and admin page are plain files served by Apache. The photo
point API is a standalone NestJS project (`api/`) because multiple projects
will consume it; the reader keeps its own API for now since its endpoints
read files from the reader's public directory. Apache routes by path.

```
/api/photos      -> dig-map-api on 127.0.0.1:3001   (photo points)
/api/...         -> reader on 127.0.0.1:3000        (trench books, unchanged)
everything else  -> static files from the repo checkout
```

## Repo layout

```
static-web-showing/
  api/                      standalone backend api project
    src/photos/             photo point module (controller, service, guard)
    src/app.module.ts
    src/main.ts             binds 127.0.0.1:3001, port via API_PORT
    scripts/import_photos.mjs
    package.json, tsconfig.json, .gitignore
  map/                      the map project, same pattern as the others
    index.html              public MapLibre map
    public_map_photos.js    photo layer for the public map
    admin.html              editor page (basic-auth protected)
    tiles/                  pmtiles archives, gitignored, uploaded via scp
```

The SQLite database never enters the repo or the docroot. It lives at
`/home/ubuntu/digmap/photos.db`: not web-downloadable, not clobbered by
`git pull`, not pushed to GitHub.

## 1. Server prerequisites

```bash
#node LTS via nodesource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs apache2-utils sqlite3
sudo a2enmod proxy proxy_http headers ssl
```

## 2. Install and build the api

```bash
cd /var/www/static-web-showing/api    #adjust to the actual docroot path
npm install
npm run build
```

## 3. Run it under systemd

`/etc/systemd/system/dig-map-api.service`:

```ini
[Unit]
Description=Dig map photo point API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/static-web-showing/api
Environment=API_PORT=3001
Environment=PHOTO_DB=/home/ubuntu/digmap/photos.db
Environment=PHOTO_EDIT_TOKEN=pick-a-long-passphrase-here
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
mkdir -p /home/ubuntu/digmap
sudo systemctl daemon-reload
sudo systemctl enable --now dig-map-api
curl http://127.0.0.1:3001/photos
```

Rotate the passphrase by editing the unit and running
`sudo systemctl restart dig-map-api`. The same unit pattern works for the
reader on port 3000 if it is not already under systemd.

## 4. Apache virtual host

Inside the site's vhost (`/etc/apache2/sites-available/...conf`). Order
matters: the more specific `/api/photos` rule must come before `/api`.

```apache
ProxyPreserveHost On
ProxyPass        /api/photos http://127.0.0.1:3001/photos
ProxyPassReverse /api/photos http://127.0.0.1:3001/photos
ProxyPass        /api        http://127.0.0.1:3000
ProxyPassReverse /api        http://127.0.0.1:3000

#basic auth in front of the editor page; second gate before the passphrase
<Directory /var/www/static-web-showing/map>
  <Files "admin.html">
    AuthType Basic
    AuthName "Photo editor"
    AuthUserFile /etc/apache2/.htpasswd-digmap
    Require valid-user
  </Files>
</Directory>
```

```bash
sudo htpasswd -c /etc/apache2/.htpasswd-digmap boss
sudo apachectl configtest && sudo systemctl reload apache2
```

HTTPS via certbot if the new instance does not have a certificate yet:
`sudo apt install certbot python3-certbot-apache && sudo certbot --apache`.
HTTPS is required before sharing the passphrase, since it travels in a
request header.

## 5. One-time import of existing photo points

On the desktop, export from the GeoPackage and copy up:

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 photo_points.geojson dig.gpkg photo_points
scp photo_points.geojson ubuntu@server:/var/www/static-web-showing/api/
```

On the server, adjust FIELD_MAP in `scripts/import_photos.mjs` to the QGIS
column names, then:

```bash
cd /var/www/static-web-showing/api
node scripts/import_photos.mjs photo_points.geojson /home/ubuntu/digmap/photos.db
sudo systemctl restart dig-map-api
```

The import upserts by id and is safe to re-run. From this point the server
database is the source of truth for photo points; remove that layer from
the PMTiles publish script so exactly one authoritative copy exists.

## 6. Tiles

Apache serves PMTiles out of the box (mod_headers handles the range
requests). Upload with `scp site.pmtiles plans.pmtiles
ubuntu@server:/var/www/static-web-showing/map/tiles/` and keep `map/tiles/`
in `.gitignore`; multi-hundred-MB binaries do not belong in git history.

## 7. Frontend wiring

- `map/index.html`: edit the CONFIG block at the top. Center/zoom, tile
  paths, the tippecanoe layer names, the years array, attribute names, and
  the `trenchDbUrl` link template.
- `map/admin.html`: set the START center/zoom near the top of the script.
  The API constant is already `/api/photos`.
- Both pages call the api same-origin through the proxy, so no CORS
  configuration is needed in practice.

## 8. QGIS round trip

Run `./sync_to_qgis.sh https://poggiocivitate.net` on the desktop to pull
the live photo layer into a dated GeoPackage. Simplest habit: treat the
synced layer as read-only context and stop hand-editing photo points in
QGIS. For a rare bulk edit: sync, edit, re-export to GeoJSON, re-run the
import script.

## 9. Backups

`/etc/cron.daily/digmap-backup` (chmod +x):

```bash
#!/bin/sh
mkdir -p /home/ubuntu/digmap/backups
sqlite3 /home/ubuntu/digmap/photos.db ".backup /home/ubuntu/digmap/backups/photos-$(date +%F).db"
find /home/ubuntu/digmap/backups -mtime +60 -delete
```

The edit_log table inside the database records who changed what and when,
so any bad edit can be traced and reversed from a backup.

## Later

- The trench-book endpoints can migrate into `api/` as another module once
  decoupling them from the reader's public directory is worth the effort.
- The photo popup `image_url` can point into the trench book reader or
  OpenContext, tying the projects together.
- The reader's Google Maps plot could eventually link into (or be replaced
  by) the MapLibre map, leaving one map to maintain.
