#!/bin/sh

# Start the worker in the background
npm run start:worker &

# Start the backend in the foreground
npm run start
