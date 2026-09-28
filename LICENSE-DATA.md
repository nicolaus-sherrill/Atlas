# Atlas data license

The Atlas database of work spots (names, locations, addresses, hours, websites, ratings, tags,
descriptions and crowd reports) is made available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The
individual contents of the database are licensed under the
[Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).

You are free to share, adapt and build on this data, including commercially, as long as you:

- **Attribute** it to Atlas and its contributors
- **Share alike:** release any adapted database you use publicly under the ODbL
- **Keep it open:** don't restrict access with technical measures unless you also offer an
  unrestricted version

## OpenStreetMap

Place details that contributors pick while adding a spot, including addresses, opening hours and
websites, come from [OpenStreetMap](https://www.openstreetmap.org/copyright).
© OpenStreetMap contributors, available under the ODbL. Atlas's database is licensed under the
ODbL so that it can include this data.

## Getting the data

- **Per view:** the Export button in the map sidebar downloads the spots you're viewing as GeoJSON
  or KML
- **Whole database:** the published spots can be read from Atlas's public API at
  `https://vjlxfznnocovxnaykhst.supabase.co/rest/v1/spots?select=*&status=eq.published`, with
  the publishable key in `artifacts/atlas/.env` sent as the `apikey` header

The application's source code is licensed separately.
