module.exports = {
    apps: [
      {
        name: 'prep-admin',
        script: 'npm',
        args: 'run start',
        env: {
          PORT: 5174,
          HOST: '127.0.0.1',
          NODE_ENV: 'production',
        },
      },
    ],
  }