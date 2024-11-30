# Use a lightweight Node.js base image
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Copy all your static files to the container
COPY . .

# Install the `serve` package globally
RUN npm install -g serve

# Expose the port Railway uses
EXPOSE 3000

# Start the server with the `serve` command
CMD ["serve", "-s", ".", "-l", "tcp://0.0.0.0:$PORT"]
