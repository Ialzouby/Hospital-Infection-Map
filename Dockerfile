# Use a lightweight Node.js image
FROM node:16

# Set the working directory
WORKDIR /app

# Copy application files to the container
COPY . .

# Install necessary tools
RUN apt-get update && apt-get install -y curl unzip

# Download the healthcare data file from Dropbox
RUN curl -L -o healthcare_data.csv "https://www.dropbox.com/scl/fi/p45kk3lozt1ty0y5q2bnt/healthcare_data.csv?rlkey=s06zo6tp9ndbga3b6otj3ygth&st=4hpm0hc0&dl=1"

# Install the serve package globally
RUN npm install -g serve

# Expose the port Railway will use (default to 3000)
EXPOSE 3000

# Start the static server
CMD ["sh", "-c", "serve . -l ${PORT:-3000}"]
