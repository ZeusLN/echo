import React, { useEffect, useState } from 'react';
import Page from '../components/Page';
import useLNC from '../hooks/useLNC';
import { hexToBase64 } from '../utils/Base64Utils';
import {
    searchPodcasts,
    podcastByFeedId,
    episodesByFeedId
} from '../utils/RequestUtils';

import BigNumber from 'bignumber.js';
import { sha256 } from 'js-sha256';
import ReactAudioPlayer from 'react-audio-player';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const randomBytes = require('randombytes');

const SUBSCRIPTION_KEY = 'apollo-subscriptions';

// pull from local localStorage
// TODO make util
let subscriptions = JSON.parse(localStorage.getItem(SUBSCRIPTION_KEY) || '');

const Home: React.FC = () => {
    const { lnc } = useLNC();
    const [info, setInfo] = useState<any>();
    const [search, setSearch] = useState<any>('Citadel Dispatch');
    const [searchResults, setSearchResults] = useState<any>([]);

    //
    const [satsPerMinute, setSatsPerMinute]: [any, any] = useState(2);
    const [activePodcast, setActivePodcast]: [any, any] = useState(null);
    const [activePodcastFunding, setActivePodcastFunding]: [any, any] =
        useState(null);
    // keep track of sent, and to send - can't keysend millisats
    const [sent, setSent]: [any, any] = useState({});
    const [carry, setCarry]: [any, any] = useState({});

    const [sentTotal, setSentTotal]: [any, any] = useState(0);
    const [carryTotal, setCarryTotal]: [any, any] = useState(0);

    const [selectedShow, setSelectedShow]: [any, any] = useState('');
    const [episodes, setEpisodes]: [any, any] = useState([]);

    const keysend = async (
        destination: string,
        amount: number,
        name: string
    ) => {
        const preimage = randomBytes(32);
        const secret = preimage.toString('base64');
        const paymentHash = hexToBase64(sha256(preimage));
        const destCustomRecords = { '5482373484': secret };

        const info = new Promise<any>(async (resolve, reject) => {
            await lnc.lnd.router.sendPaymentV2(
                {
                    dest: hexToBase64(destination),
                    amt: amount.toString(),
                    destCustomRecords,
                    paymentHash,
                    timeoutSeconds: 30
                },
                (event: any) => {
                    if (event.status === 'SUCCEEDED') resolve(event);
                    if (event.status === 'FAILED') reject(event);
                },
                (error: Error) => {
                    if (error.toString() !== 'Error: EOF') reject();
                }
            );
        });
        const msg = `payment of ${amount} ${
            amount > 1 ? 'sats' : 'sat'
        } to ${name}`;
        toast.promise(info, {
            pending: `Attempting ${msg}`,
            success: `Successful ${msg}`,
            error: `Failed ${msg} 😭`
        });

        return info;
    };

    const processPayment = async (o: any) => {
        const newSent: any = sent;
        const newCarry: any = carry;
        let failure = false;
        const amountToAdd = new BigNumber(satsPerMinute)
            .multipliedBy(o.split)
            .dividedBy(100);

        const amountOwed = amountToAdd.plus(carry[o.address] || 0);

        console.log(`amountOwed for ${o.name}: ${amountOwed}`);

        // cannot send millisats in keysend
        const amountToSend = amountOwed.toString().includes('.')
            ? new BigNumber(amountOwed.toString().split('.')[0])
            : amountOwed;

        const amountToCarry = amountOwed.toString().includes('.')
            ? new BigNumber(`.${amountOwed.toString().split('.')[1]}`)
            : new BigNumber(0);

        // attempt keysend here
        if (amountToSend.gt(0)) {
            const result = await keysend(
                o.address,
                amountToSend.toNumber(),
                o.name
            );
            if (result.status === 'SUCCEEDED') {
                const msg = `SUCCESS: Payment of ${amountToSend} sats to ${o.name}`;
                console.warn(msg);
            } else {
                const msg = `FAILURE: Payment of ${amountToSend} sats to ${o.name}`;
                console.warn(msg);
                failure = true;
            }
        }

        newSent[o.address] = sent[o.address]
            ? failure
                ? sent[o.address].plus(0)
                : sent[o.address].plus(amountToSend)
            : amountToSend;

        newCarry[o.address] = carry[o.address]
            ? failure
                ? carry[o.address].plus(amountOwed)
                : amountToCarry
            : amountToCarry;

        console.log(`newSent for ${o.name}: ${newSent[o.address]}`);
        console.log(`newCarry for ${o.name}: ${newCarry[o.address]}`);

        setSent(newSent);
        setCarry(newCarry);

        return;
    };

    const handleSearchChange = (event: any) => setSearch(event.target.value);

    const handlePodcastSearch = (event: any) => {
        event.preventDefault();
        searchPodcasts(search).then((data: any) => setSearchResults(data));
    };

    useEffect(() => {
        if (lnc.isConnected) {
            const sendRequest = async () => {
                const res = await lnc.lnd.lightning.getInfo();
                setInfo(res);
            };
            sendRequest();
        }
    }, [lnc.isConnected, lnc.lnd.lightning]);

    useEffect(() => {
        if (selectedShow[1]) {
            episodesByFeedId(selectedShow[1].id).then((data: any) => {
                setEpisodes(data);
            });
        } else {
            setEpisodes([]);
        }
    }, [selectedShow]);

    useEffect(() => {
        if (!!sent) {
            let total = new BigNumber(0);
            Object.keys(sent).map((o: any) => {
                total = total.plus(sent[o]);
                setSentTotal(total);
            });
        }

        if (!!carry) {
            let total = new BigNumber(0);
            Object.keys(carry).map((o: any) => {
                total = total.plus(carry[o]);
                setCarryTotal(total);
            });
        }
    });

    return (
        <Page>
            <h2 className="text-center">Welcome to Apollo</h2>
            <p className="text-center">
                {lnc.isConnected
                    ? `You are now connected to your Lightning node, ${
                          info && info.alias ? info.alias : ''
                      }`
                    : 'Connect or Login to start listening to podcasts.'}
            </p>
            {lnc.isConnected && (
                <>
                    <form onSubmit={handlePodcastSearch}>
                        <label>
                            Search for a podcast:{' '}
                            <input
                                type="text"
                                value={search}
                                onChange={handleSearchChange}
                            />
                        </label>
                        <input type="submit" value="Submit" />
                    </form>
                    {searchResults &&
                        searchResults.map((o: any, index: number) => {
                            return (
                                <div key={index}>
                                    <p>
                                        {o.title} - Episode count:{' '}
                                        {o.episodeCount}
                                    </p>
                                    <p
                                        onClick={() =>
                                            podcastByFeedId(o.id).then(
                                                (data: any) => {
                                                    subscriptions[o.title] =
                                                        data;
                                                    localStorage.setItem(
                                                        SUBSCRIPTION_KEY,
                                                        JSON.stringify(
                                                            subscriptions
                                                                ? subscriptions
                                                                : {
                                                                      [o.title]:
                                                                          data
                                                                  }
                                                        )
                                                    );
                                                    subscriptions =
                                                        localStorage.getItem(
                                                            SUBSCRIPTION_KEY
                                                        );
                                                }
                                            )
                                        }
                                    >
                                        Add podcast to Apollo
                                    </p>
                                </div>
                            );
                        })}
                </>
            )}
            {lnc.isConnected && (
                <>
                    <form>
                        <label>
                            <p>Sats per minute:</p>
                            <input
                                type="text"
                                value={satsPerMinute}
                                onChange={(e: any) =>
                                    setSatsPerMinute(e.target.value)
                                }
                                style={{
                                    color: 'orange',
                                    fontSize: 50,
                                    width: 100,
                                    textAlign: 'center',
                                    background: 'transparent',
                                    border: 'none'
                                }}
                            />
                        </label>
                    </form>
                    {activePodcast && <p>{activePodcast.title}</p>}
                    {activePodcast && (
                        <ReactAudioPlayer
                            src={activePodcast.enclosureUrl}
                            autoPlay
                            controls
                            onListen={async () => {
                                // parallel
                                // await activePodcast.recipients.map(async (o: any) => {
                                //     await processPayment(o);
                                // });

                                // series
                                for (const recipient of activePodcastFunding.destinations) {
                                    console.log(
                                        '! Starting processing of payment to',
                                        recipient.name
                                    );
                                    await processPayment(recipient);
                                }
                                return;
                            }}
                            // trigger onListen every minute
                            listenInterval={60000}
                        />
                    )}
                    {activePodcast && activePodcastFunding.destinations && (
                        <p style={{ fontWeight: 'bold' }}>
                            Value4Value recipients
                        </p>
                    )}
                    {activePodcast && activePodcastFunding.destinations && (
                        <p style={{ fontWeight: 'bold' }}>
                            Total sent: {sentTotal.toString()}
                        </p>
                    )}
                    {activePodcast &&
                        activePodcastFunding.destinations.map(
                            (o: any, index: number) => {
                                return (
                                    <div key={index}>
                                        <p>
                                            {o.name} - {o.split}% -{' '}
                                            {new BigNumber(satsPerMinute)
                                                .multipliedBy(o.split)
                                                .dividedBy(100)
                                                .toString()}{' '}
                                        </p>
                                        {sent && sent[o.address] && (
                                            <p
                                                style={{
                                                    color:
                                                        sent[o.address] &&
                                                        sent[o.address].gte(1)
                                                            ? 'green'
                                                            : 'black'
                                                }}
                                            >
                                                Sent:{' '}
                                                {sent[o.address]
                                                    ? sent[o.address].toString()
                                                    : '0'}{' '}
                                            </p>
                                        )}
                                        {carry && carry[o.address] && (
                                            <p
                                                style={{
                                                    color:
                                                        carry[o.address] &&
                                                        carry[o.address].gte(1)
                                                            ? 'red'
                                                            : 'black'
                                                }}
                                            >
                                                Carry:{' '}
                                                {carry[o.address]
                                                    ? carry[
                                                          o.address
                                                      ].toString()
                                                    : '0'}
                                            </p>
                                        )}
                                    </div>
                                );
                            }
                        )}
                    {!!subscriptions && (
                        <p style={{ fontWeight: 'bold' }}>Your subscriptions</p>
                    )}
                    {!!subscriptions ? (
                        Object.entries(subscriptions).map(
                            (o: any, key: any) => {
                                const showName = o[0];
                                return (
                                    <div key={key}>
                                        <p
                                            onClick={() => {
                                                selectedShow[0] === showName
                                                    ? setSelectedShow([])
                                                    : setSelectedShow(o);
                                            }}
                                            style={{
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {`${
                                                selectedShow[0] === showName
                                                    ? '⇃'
                                                    : '⇁'
                                            } ${showName}`}
                                        </p>
                                        {selectedShow[0] === showName &&
                                            episodes.map(
                                                (
                                                    episode: any,
                                                    index: number
                                                ) => {
                                                    return (
                                                        <p
                                                            key={index}
                                                            onClick={() => {
                                                                setActivePodcastFunding(
                                                                    subscriptions[
                                                                        showName
                                                                    ].value
                                                                );
                                                                setActivePodcast(
                                                                    episode
                                                                );
                                                            }}
                                                            style={{
                                                                cursor: 'pointer'
                                                            }}
                                                        >{`▶️ ${episode.title}`}</p>
                                                    );
                                                }
                                            )}
                                    </div>
                                );
                            }
                        )
                    ) : (
                        <p>
                            No subscriptions added yet. Search for your favorite
                            podcasts above.
                        </p>
                    )}
                </>
            )}
            <ToastContainer />
        </Page>
    );
};

export default Home;
