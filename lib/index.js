const axios = require('axios');
const moment = require('moment');
const chalk = require('chalk');

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

  console.dir(pullRequests);

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
    } = settings;

    const options = {
      auth: {
        username,
        password,
      },
    };

    const pullRequests = await getPullRequests(settings);

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
                commiterDate: commit.committerTimestamp,
                email: commit.committer.emailAddress,
                message,
              };
            })
            .filter(
              ({ message }) =>
                !messageRegex || new RegExp(messageRegex).test(message)
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
          dateFormat ? `(${moment(c.commiterDate).format(dateFormat)})` : ''
        }`
          .replace(match, '')
          .trim();
      });

    console.log(
      chalk.green('Result:'),
      chalk.blue(messageRegex),
      chalk.blue(email)
    );

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
  getPullRequests,
};
