#!/usr/bin/env node
const chalk = require('chalk');
const prompt = require('prompt');
const fs = require('fs');
const path = require('path');

const { getPullRequestCommits } = require('./lib');

const saveConfiguration = (config) => {
  const filepath = path.join(__dirname, './.config');

  const payload = JSON.stringify(config);
  const data = Buffer.from(payload).toString('base64');

  fs.writeFileSync(filepath, data);
};

const getConfiguration = () => {
  const filepath = path.join(__dirname, './.config');

  if (!fs.existsSync(filepath)) return null;

  const payload = fs.readFileSync(filepath, 'utf-8');
  const data = JSON.parse(Buffer.from(payload, 'base64').toString());

  // const [username, password] = data.split(' : ');

  return data;
};

const CONFIG = getConfiguration();

const getDefaultValue = (key, defaultValue = '') => (CONFIG && !!CONFIG[key] ? CONFIG[key] : defaultValue);

const schema = {
  properties: {
    username: {
      description: 'Enter your JIRA username',
      message: 'username is requried!',
      type: 'string',
      required: true,
      default: getDefaultValue('username'),
    },
    password: {
      description: 'Enter your JIRA password',
      message: 'password is required!',
      type: 'string',
      replace: '*',
      hidden: true,
      required: true,
      default: getDefaultValue('password'),
    },
    projectSlug: {
      description: 'Enter your bitbucket project slug',
      message: 'project slug is required!',
      type: 'string',
      required: true,
      default: getDefaultValue('projectSlug', 'BAC'),
    },
    repoName: {
      description: 'Enter your bitbucket repository name',
      message: 'repository name is required!',
      type: 'string',
      required: true,
      default: getDefaultValue('repoName', 'back-office-actual'),
    },
    filterByEmail: {
      description: 'Filter by committer e-mail',
      type: 'string',
      pattern: /^[y|N]$/,
      message: 'Must be "y" for yes and "N" for no.',
      default: getDefaultValue('filterByEmail', 'N'),
    },
    email: {
      description: 'Enter committer e-mail address to filter',
      message: 'Must be a valid e-mail format',
      type: 'string',
      format: 'email',
      default: getDefaultValue('email'),
      ask() {
        return prompt.history('filterByEmail').value === 'y';
      },
    },
    pullRequests: {
      description: 'Enter pull requests id\'s (separated by ",")',
      required: true,
      pattern: /[0-9,]/,
      type: 'string',
      default: getDefaultValue('pullRequests'),
      conform(value) {
        const totalPullRequests = value
          .replace(/\s/, '')
          .split(',')
          .filter(v => !!v).length;

        return totalPullRequests > 0;
      },
      message: 'At least 1 pull request id is required, please enter only numbers and commas.',
    },
    useMessageRegex: {
      description: 'Filter commits message?',
      type: 'string',
      pattern: /^[y|N]$/,
      message: 'Must be "y" for yes and "N" for no.',
      default: getDefaultValue('useMessageRegex', 'N'),
    },
    messageRegex: {
      description: 'Enter message regex pattern to filter',
      message: 'Must be a valid regex format',
      type: 'string',
      format: 'regex',
      default: getDefaultValue('messageRegex', '^BAC-[0-9]{1,}\\s.*'),
      ask() {
        return prompt.history('useMessageRegex').value === 'y';
      },
    },
  },
};

//
// Setting these properties customizes the prompt.
//
prompt.message = chalk.green('? ');
prompt.delimiter = chalk.green('');

prompt.start();

prompt.get(schema, (err, result) => {
  if (err) {
    if (err.toString() !== 'Error: canceled') {
      console.dir(err.toString(), { colors: true });
    }

    process.exit(1);
  }

  saveConfiguration(result);

  console.clear();

  const {
    username,
    password,
    filterByEmail,
    email,
    pullRequests,
    useMessageRegex,
    messageRegex,
    projectSlug,
    repoName,
  } = result;

  getPullRequestCommits(
    pullRequests
      .replace(/\s/, '')
      .split(',')
      .filter(v => !!v),
    {
      username,
      password,
      projectSlug,
      repoName,
      email: filterByEmail === 'y' && email,
      messageRegex: useMessageRegex === 'y' && messageRegex,
    },
  );
});

// const { username: USERNAME, password: PASSWORD } = argv;

// console.clear();

// if (!USERNAME || !PASSWORD) {
//   console.log(`${chalk.red('Error:')} --username and --password are required.`);
//   process.exit(1);
// }

// console.dir(argv, { colors: true });

// // const PASSWORD = '4a9Xp!&x7@9F';

// const API_URI = 'https://bitbucket.playzido.com/rest/api/1.0/projects/BAC/repos/back-office-actual';
// // const PULL_REQUESTS_URI = `${API_URI}/pull-requests?state=MERGED&at=refs%2Fheads%2Fmaster`;

// const options = {
//   auth: {
//     username: USERNAME,
//     password: PASSWORD
//   }
// };

// const getCommitsUri = id => `${API_URI}/pull-requests/${id}/commits?start=0&limit=1000`;

// const sortByComitter = (a, b) => {
//   if (a.committer < b.committer) return -1;
//   if (a.committer > b.committer) return 1;
//   return 0;
// };

// getPullRequestCommits(
//   [246, 257, 267, 279, 288],
//   { email: 'andre.alves@inspireit.pt' }
// );
