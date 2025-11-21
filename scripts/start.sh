#!/bin/sh

# Run database migrations
npx prisma migrate deploy

# Start the worker in the background
npm run start:worker &

# Start the backend in the foreground
npm run start
