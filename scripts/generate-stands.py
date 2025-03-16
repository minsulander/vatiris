import os
import json

data = {}

input_file = f"{os.environ.get('APPDATA')}\\EuroScope\\ESAA\\Plugins\\GRpluginStands.txt"
output_file = os.path.join(os.path.dirname(__file__), '../frontend/src/data/stands.json')


def convert_lonlat(lon, lat):
    lon_deg = int(lon[1:4]) + int(lon[5:7])/60.0 + float(lon[8:])/3600
    if lon[0] == "W": lon_deg = -lon_deg
    lat_deg = int(lat[1:4]) + int(lat[5:7])/60.0 + float(lat[8:])/3600
    if lat[0] == "S": lat_deg = -lat_deg
    return [lon_deg, lat_deg]


airport = None
stand = None
with open(input_file, "r") as f:
    for line in f:
        line = line.strip()
        if line.startswith("STAND:"):
            tokens = line.split(":")
            airport = tokens[1]
            stand = tokens[2]
            if airport not in data: data[airport] = {}
            data[airport][stand] = {}
            if len(tokens) >= 6:
                lat = tokens[3]
                lon = tokens[4]
                radius = tokens[5] # in meters
                data[airport][stand]["center"] = convert_lonlat(lon, lat)
                data[airport][stand]["radius"] = radius
        elif line.startswith("COORD:"):
            tokens = line.split(":")
            lat = tokens[1]
            lon = tokens[2]
            if "coords" not in data[airport][stand]: data[airport][stand]["coords"] = []
            data[airport][stand]["coords"].append(convert_lonlat(lon, lat))
        elif line.strip() == "AREA":
            data[airport][stand]["area"] = True

for airport in data:
    for stand in data[airport]:
        if "center" not in data[airport][stand]:
            if "coords" not in data[airport][stand]:
                print(f"Stand {stand} at {airport} has no center or coords")
                continue
            # Calculate center
            lat = 0
            lon = 0
            for coord in data[airport][stand]["coords"]:
                lon += coord[0]
                lat += coord[1]
            lon /= len(data[airport][stand]["coords"])
            lat /= len(data[airport][stand]["coords"])
            data[airport][stand]["center"] = [lon, lat]

# Write the data to the JSON file
with open(output_file, 'w') as json_file:
    json.dump(data, json_file, indent=4)

