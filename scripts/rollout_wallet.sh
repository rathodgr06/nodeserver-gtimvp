#!/bin/bash

# URL of the API
URL="http://localhost:4008/api/v1/roll-out-wallet"

# Execute POST request with empty data
response=$(curl --silent --show-error --location --request POST "$URL" --data '')

# Print response
echo "Response from API:"
echo "$response"
