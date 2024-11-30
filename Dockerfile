# Use a lightweight Node.js image
FROM node:16

# Set the working directory
WORKDIR /app

# Copy application files
COPY . .

# Install necessary tools
RUN apt-get update && apt-get install -y curl unzip

# Download the CSV file from Dropbox
RUN curl -L -o healthcare_data.csv "https://www.dropbox.com/scl/fi/p45kk3lozt1ty0y5q2bnt/healthcare_data.csv?rlkey=s06zo6tp9ndbga3b6otj3ygth&st=4hpm0hc0&dl=1"

# Install a static server
RUN npm install -g serve

# Expose the port Railway will use
EXPOSE 3000

# Start the static server
CMD ["serve", ".", "-l", "3000"]
