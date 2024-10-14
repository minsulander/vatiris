import json

def parse_txt_to_json(input_file, output_file):
    with open(input_file, 'r') as f:
        content = f.read()

    coordinations = []
    current_id = None

    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('**') and line.endswith('**'):
            current_id = {"id": line.strip('*'), "groups": []}
            coordinations.append(current_id)
        elif line.startswith('--') and line.endswith('--'):
            if current_id is None:
                raise ValueError("Group encountered before any ID was specified")
            current_id["groups"].append({"group": line.strip('-'), "items": []})
        elif line:
            if not current_id or not current_id["groups"]:
                raise ValueError("Item encountered before any group was specified")
            current_id["groups"][-1]["items"].append(line)

    with open(output_file, 'w') as f:
        json.dump(coordinations, f, indent=2)

    print(f"JSON file '{output_file}' has been generated successfully.")

# Usage
input_file = 'coordinations.txt'
output_file = 'coordinations.json'
parse_txt_to_json(input_file, output_file)
