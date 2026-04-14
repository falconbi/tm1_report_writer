#!/bin/bash
fuser -k 8080/tcp
fuser -k 5173/tcp
echo "Killed ports 8080 and 5173"