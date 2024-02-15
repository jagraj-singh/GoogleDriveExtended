# Google Drive API Interaction using NodeJs

This repository contains a simple Node.js application that interacts with Redis using Docker Compose. The Docker Compose configuration includes separate services for the Node.js application and Redis, allowing them to communicate within the same Docker network.

## Prerequisites

Before getting started, make sure you have the following installed on your machine:

- Docker: [Install Docker](https://docs.docker.com/get-docker/)
- Docker Compose: [Install Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

1. Clone this repository to your local machine:

   ```bash
   git clone https://github.com/jagraj-singh/GoogleDriveExtended.git
   cd GoogleDriveExtended
   ```

2. Create a .env file with following contents

   ```bash
   PORT=8080
   REDIS_PORT=6379
   REDIS_HOST=redis
   ```

3. Obtain your service accounts crentials and create a serviceAccountKey.json file
   (https://www.labnol.org/google-api-service-account-220404)

4. Build and run the Docker containers using Docker Compose:

   ```bash
   docker-compose up -d
   ```

   This command will build the Docker images and start the containers in detached mode.

5. Access your Node.js application at http://localhost:3000.

## Application Structure

- src: This directory contains source code.
- api-specs - This directory contains api-specs for the application
- main.js: Main entry point for the Node.js application.
- Dockerfile: Dockerfile for building the Node.js application image.
- docker-compose.yml: Docker Compose configuration file defining services for the Node.js app and Redis.
- package.json and package-lock.json: Node.js application dependencies.

## Test the App

1. To start download and upload procedure

```bash
curl --location 'http://localhost:8080/v1/download-and-copy' \
--header 'Content-Type: application/json' \
--data '{
    "fileId" : "{{your_file_id}}"
}'
```

This will return a requestId which can be used futher to check status of upload or download

2. To check download/upload status

```bash
curl --location 'http://localhost:8080/v1/status?requestId={{request_id}}8&operation=download'
```
