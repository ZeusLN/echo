import axios from 'axios';
import config from './../../config.json';
import packageInfo from './../../package.json';

const sha1 = require('js-sha1');

const BASE_URL = 'https://api.podcastindex.org/api/1.0';

const reqInstance = () => {
    const unixTime = new Date().getTime().toString().slice(0, -3);
    const { podcastIndexAPIKey, podcastIndexSecretKey } = config;
    const hash = sha1(
        `${podcastIndexAPIKey}${podcastIndexSecretKey}${unixTime}`
    );

    return axios.create({
        headers: {
            Authorization: hash,
            'X-Auth-Key': podcastIndexAPIKey,
            'X-Auth-Date': unixTime,
            'User-Agent': `Echo v${packageInfo.version}`
        }
    });
};

const searchPodcasts = (searchString = '') => {
    return reqInstance()
        .get(`${BASE_URL}/search/byterm?q=${searchString}`)
        .then((res: any) => {
            const shows = res.data.feeds;
            return shows;
        })
        .catch((err: Error) => {
            console.log('Error: ', err.message);
        });
};

const podcastByFeedId = (searchString = '') => {
    return reqInstance()
        .get(`${BASE_URL}/podcasts/byfeedid?id=${searchString}`)
        .then((res: any) => {
            const show = res.data.feed;
            return show;
        })
        .catch((err: Error) => {
            console.log('Error: ', err.message);
        });
};

const episodesByFeedId = (searchString = '') => {
    return reqInstance()
        .get(`${BASE_URL}/episodes/byfeedid?id=${searchString}`)
        .then((res: any) => {
            const episodes = res.data.items;
            return episodes;
        })
        .catch((err: Error) => {
            console.log('Error: ', err.message);
        });
};

export { searchPodcasts, podcastByFeedId, episodesByFeedId };
