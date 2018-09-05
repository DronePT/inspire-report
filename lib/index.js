const axios = require('axios');
const moment = require('moment');
const chalk = require('chalk');

const {
  API_URI = 'https://bitbucket.playzido.com/rest/api/1.0/projects/BAC/repos/back-office-actual',
} = process.env;

const getCommitsUri = id => `${API_URI}/pull-requests/${id}/commits?start=0&limit=1000`;

const sortByDate = (a, b) => {
  if (a.commiterDate < b.commiterDate) return -1;
  if (a.commiterDate > b.commiterDate) return 1;
  return 0;
};

const getPullRequestCommits = async (
  pullRequests = [],
  {
    username,
    password,
    email,
    messageRegex = '^BAC-[0-9]{1,}\\s.*',
    dateFormat = 'DD-MM-YY HH:mm:ss',
  },
) => {
  try {
    const options = {
      auth: {
        username,
        password,
      },
    };

    const result = (await Promise.all(
      pullRequests.map(async (pr) => {
        const response = await axios.get(getCommitsUri(pr), options);
        const {
          data: { values },
        } = response;

        return values
          .map((commit) => {
            // const [message] = commit.message.split('\n');
            const message = commit.message
              .replace(/\n/gim, ' ')
              .replace(/\\n/gim, ' ')
              .replace(/\s\s/gim, ' ');

            return {
              author: commit.author.name,
              authorDate: commit.authorTimestamp,
              committer: commit.committer.name,
              commiterDate: commit.committerTimestamp,
              email: commit.committer.emailAddress,
              message,
            };
          })
          .filter(({ message }) => !messageRegex || new RegExp(messageRegex).test(message));
      }),
    ))
      .reduce((acc, curr) => [].concat(acc, curr), [])
      .filter(commit => !email || commit.email === email)
      .sort(sortByDate)
      .map(c => `${c.message} ${dateFormat ? `(${moment(c.commiterDate).format(dateFormat)})` : ''}`.trim());

    console.log(chalk.green('Result:'), chalk.blue(messageRegex), chalk.blue(email));

    result.forEach((row) => {
      console.log(row);
    });
  } catch (error) {
    const { response } = error;
    if (response) {
      console.dir(response.data, { colors: true });
    } else {
      console.error(error);
    }
  }
};

module.exports = {
  getPullRequestCommits,
};
