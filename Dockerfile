# Step 1: Use a lightweight Node.js image as the base
FROM node:18-slim

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy all files from your project to the container
COPY . .

# Step 4: Install `http-server` globally
RUN npm install -g http-server

# Step 5: Expose the port your app will use
EXPOSE 3000

# Step 6: Set the default command to start `http-server`
CMD ["sh", "-c", "http-server -p ${PORT:-3000}"]
