#!/bin/bash

echo "$(tput bold dim)Performing test update on the User collection in the MongoDB cluster..$(tput sgr 0)$(tput bold)"

docker exec -it router mongosh /app/scripts/update.js

echo -e "\n$(tput dim)Test update completed.$(tput sgr 0)"
