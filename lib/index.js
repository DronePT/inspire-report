const axios = require('axios');
const moment = require('moment');
const chalk = require('chalk');
const emojilib = require('emojilib');
const fs = require('fs');
const path = require('path');

const getEmojiFromCode = (code) => {
  const text = code.replace(/:/gim, '');

  const emoji = emojilib.lib[text] || { char: '' };

  return emoji.char;
};

const getCommitsUri = (id, projectSlug, repoName) =>
  `https://bitbucket.playzido.com/rest/api/1.0/projects/${projectSlug}/repos/${repoName}/pull-requests/${id}/commits?start=0&limit=1000`;
const getPullRequestUri = (projectSlug, repoName) =>
  `https://bitbucket.playzido.com/rest/api/1.0/projects/${projectSlug}/repos/${repoName}/pull-requests?order=newest&state=MERGED&start=0&limit=1000`;

const sortByDate = (a, b) => {
  if (a.commiterDate < b.commiterDate) return -1;
  if (a.commiterDate > b.commiterDate) return 1;
  return 0;
};

const getPullRequests = async (settings) => {
  const {
    username,
    password,
    projectSlug,
    repoName,
    startDate,
    endDate,
  } = settings;

  const options = {
    auth: {
      username,
      password,
    },
  };

  const url = getPullRequestUri(projectSlug, repoName);

  const result = await axios.get(url, options);

  if (!result || !result.data || !result.data.values) {
    throw new Error('No pull requests found');
  }

  const startMonth = moment(startDate).startOf('day');
  const endMonth = moment(endDate).endOf('day');

  console.log(
    `Fetching pull requests between ${startMonth.format()} and ${endMonth.format()}`
  );

  const pullRequests = result.data.values
    .map((pr) => ({
      id: pr.id,
      date: moment(pr.createdDate),
    }))
    .filter((pr) => pr.date.isBetween(startMonth, endMonth))
    .map((pr) => pr.id);

  console.log('Pull requests:', pullRequests.join(', '));

  return pullRequests;
};

const getPullRequestCommits = async (settings) => {
  try {
    const {
      username,
      password,
      projectSlug,
      repoName,
      email,
      messageRegex = '^BAC-[0-9]{1,}\\s.*',
      dateFormat = 'DD-MM-YY HH:mm:ss',
      startDate,
      endDate,
    } = settings;

    const options = {
      auth: {
        username,
        password,
      },
    };

    const pullRequests = await getPullRequests(settings);

    const startMonth = moment(startDate).startOf('day');
    const endMonth = moment(endDate).endOf('day');

    const result = (
      await Promise.all(
        pullRequests.map(async (pr) => {
          const response = await axios.get(
            getCommitsUri(pr, projectSlug, repoName),
            options
          );
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
                id: commit.id,
                author: commit.author.name,
                authorDate: commit.authorTimestamp,
                committer: commit.committer.name,
                commiterDate: moment(commit.committerTimestamp),
                email: commit.committer.emailAddress,
                message,
              };
            })
            .filter(
              ({ message, commiterDate }) =>
                (!messageRegex || new RegExp(messageRegex).test(message)) &&
                commiterDate.isBetween(startMonth, endMonth) &&
                !/^merge.*/gim.test(message)
            );
        })
      )
    )
      .reduce((acc, curr) => [].concat(acc, curr), [])
      .reduce((acc, curr) => {
        const f = acc.find((a) => a.id === curr.id);

        return !f ? [].concat(acc, [curr]) : acc;
      }, [])
      .filter((commit) => !email || commit.email === email)
      .sort(sortByDate)
      .map((c) => {
        const re = /(^:.*:)\s/gim; // ?

        const [, match] = re.exec(c.message) || ['', ''];

        return `${c.message} ${
          dateFormat ? `(${c.commiterDate.format(dateFormat)})` : ''
        }`
          .replace(match, getEmojiFromCode(match))
          .trim();
      });

    if (messageRegex)
      console.log('Commit messages filtered by:', chalk.blue(messageRegex));
    if (email) console.log('Commits filtered by e-mail:', chalk.blue(email));

    const filename = `${startMonth.format('DD-MM-YYYY')}-TO-${endMonth.format(
      'DD-MM-YYYY'
    )}.html`;

    console.log('Generating HTML report:', filename);

    console.log(chalk.green('\nResult:'));

    const file = fs.createWriteStream(
      path.resolve(__dirname, '../reports', filename)
    );

    file.write(`<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report - </title>
  <style>
    ul {
      font-family: Arial;
      line-height: 32px;
      font-size: 16px;
    }
  </style>
</head>

<body>
  <ul>`);

    result.forEach((row) => {
      file.write(`\n\t<li>${row}</li>`);
      console.log(row);
    });

    file.write(`
  </ul>
</body>
</html>`);
    file.end();
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
  getPullRequests,
};
