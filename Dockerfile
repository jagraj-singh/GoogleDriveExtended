# Use the official Node.js 18 base image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port on which your Node.js app will run
EXPOSE 8080

# Start the Node.js application
CMD ["node", "src/main.js"]
