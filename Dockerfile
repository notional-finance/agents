FROM node:12-alpine

# Create our containers WORKDIR and "node_modules" directory.
# Give the user:group "node" ownership of all files/directories in our containers WORKDIR
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package.json ./
COPY yarn.lock ./
COPY dist ./dist

# Creates a user for our container
USER node
# Installs our NPM packages from the "package.json" file we moved from local in to our container
RUN yarn install --production

# Tells our container who owns the copied content
COPY --chown=node:node . .

EXPOSE 7879

# An array of commands our container needs to run when we start it
CMD ["node", "dist/app.js"]
