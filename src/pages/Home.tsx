import React, { useEffect, useState } from 'react';
import Page from '../components/Page';
import useLNC from '../hooks/useLNC';
import { hexToBase64, utf8ToHexString } from '../utils/Base64Utils';
import {
    searchPodcasts,
    podcastByFeedId,
    episodesByFeedId
} from '../utils/RequestUtils';
import packageInfo from './../../package.json';

import { cloneDeep } from 'lodash';
import BigNumber from 'bignumber.js';
import { sha256 } from 'js-sha256';
import ReactAudioPlayer from 'react-audio-player';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const randomBytes = require('randombytes');

const LOCALSTORAGE_SUBSCRIPTION_KEY = 'echo-subscriptions';
const LOCALSTORAGE_SPM_KEY = 'echo-sats-per-minute';
const DEFAULT_BOOST_AMT = 1_000;
const DEFAULT_SATS_PER_MINUTE = 100;
const DEFAULT_BOOST_SENDER = 'An anonymous Echo user';

const Home: React.FC = () => {
    const { lnc } = useLNC();
    const [info, setInfo] = useState<any>({});

    // SEARCH
    const [search, setSearch] = useState<any>('');
    const [searchField, setSearchField] = useState<any>('');
    const [searchResults, setSearchResults] = useState<any>([]);

    // NAVIGATION
    const [selectedShow, setSelectedShow]: [any, any] = useState('');
    const [episodes, setEpisodes]: [any, any] = useState([]);

    // SETTINGS
    const [showSettings, toggleShowSettings] = useState(false);
    const [satsPerMinute, setSatsPerMinute]: [any, any] = useState(
        localStorage.getItem(LOCALSTORAGE_SPM_KEY)
            ? Number(localStorage.getItem(LOCALSTORAGE_SPM_KEY))
            : DEFAULT_SATS_PER_MINUTE
    );
    const [supportEcho, toggleSupportEcho] = useState(true);

    // NOW PLAYING
    const [activePodcast, setActivePodcast]: [any, any] = useState(null);
    const [activeShow, setActiveShow]: [any, any] = useState(null);
    const [activePodcastFunding, setActivePodcastFunding]: [any, any] =
        useState(null);
    const [activePodcastFundingUnmodified, setActivePodcastFundingUnmodified]: [
        any,
        any
    ] = useState(null);

    // STATS
    // keep track of sent, and to send - can't keysend millisats
    const [sent, setSent]: [any, any] = useState({});
    const [carry, setCarry]: [any, any] = useState({});
    const [sentTotal, setSentTotal]: [any, any] = useState(new BigNumber(0));
    const [showStats, toggleShowStats] = useState(false);

    const clearStats = () => {
        setSentTotal(new BigNumber(0));
        setSent({});
        setCarry({});
    };

    // SUBSCRIPTIONS
    const [subscriptions, setSubscriptions]: [any, any] = useState(
        localStorage.getItem(LOCALSTORAGE_SUBSCRIPTION_KEY)
            ? JSON.parse(
                  localStorage.getItem(LOCALSTORAGE_SUBSCRIPTION_KEY) || ''
              )
            : {}
    );
    const [editMode, toggleEditMode] = useState(false);

    // BOOSTS
    const [boostRecipient, setBoostRecipient] = useState(null);
    const [boostRecipientName, setBoostRecipientName] = useState('');
    const [boostAmount, setBoostAmount] = useState(DEFAULT_BOOST_AMT);
    const [boostMessage, setBoostMessage] = useState('');
    const [boostSender, setBoostSender] = useState(DEFAULT_BOOST_SENDER);

    const resetBoost = () => {
        setBoostRecipient(null);
        setBoostRecipientName('');
        setBoostAmount(DEFAULT_BOOST_AMT);
        setBoostMessage('');
        setBoostSender(DEFAULT_BOOST_SENDER);
    };

    const keysend = async (
        destination: string,
        amount: number,
        name: string,
        boostMsg?: string,
        boostSender?: string
    ) => {
        const preimage = randomBytes(32);
        const secret = preimage.toString('base64');
        const paymentHash = hexToBase64(sha256(preimage));
        const destCustomRecords: any = { '5482373484': secret };

        let paymentRequest = {
            dest: hexToBase64(destination),
            amt: amount.toString(),
            destCustomRecords,
            paymentHash,
            timeoutSeconds: 30
        };

        if (boostMsg || boostSender) {
            const message = JSON.stringify({
                podcast: activeShow[0],
                feedID: activeShow[1].id,
                url: activeShow[1].originalUrl,
                guid: activeShow[1].podcastGuid,
                episode: activePodcast.title,
                app_name: 'Echo',
                app_version: packageInfo.version,
                sender_name: boostSender,
                message: boostMsg
            });
            const hex_message = hexToBase64(utf8ToHexString(message));
            destCustomRecords!['7629169'] = hex_message;
        }

        const info = new Promise<any>(async (resolve, reject) => {
            await lnc.lnd.router.sendPaymentV2(
                paymentRequest,
                (event: any) => {
                    if (event.status === 'SUCCEEDED') {
                        resolve(event);
                        if (boostMsg || boostSender) resetBoost();
                    }
                    if (event.status === 'FAILED') reject(event);
                },
                (error: Error) => {
                    if (error.toString() !== 'Error: EOF') reject();
                }
            );
        });
        const msg = `${boostMsg ? 'boost' : 'payment'} of ${amount} ${
            amount > 1 ? 'sats' : 'sat'
        } to ${name}`;
        toast.promise(info, {
            pending: `Attempting ${msg}`,
            success: `Successful ${msg}`,
            error: `Failed ${msg} 😭`
        });

        return info;
    };

    const sendBoost = async (
        destination: string,
        amount: number,
        name: string,
        boostMsg?: string,
        boostSender?: string
    ) => {
        const newSent: any = sent;

        try {
            const result = await keysend(
                destination,
                amount,
                name,
                boostMsg,
                boostSender
            );
            if (result.status === 'SUCCEEDED') {
                const msg = `SUCCESS: Boost of ${amount} sats to ${name}`;
                console.warn(msg);

                newSent[destination] = sent[destination]
                    ? sent[destination].plus(amount)
                    : new BigNumber(amount);

                console.log(`newSent for ${name}: ${newSent[destination]}`);

                setSent(newSent);

                const total = sentTotal.plus(amount);
                setSentTotal(total);
            } else {
                const msg = `FAILURE: Boost of ${amount} sats to ${name}`;
                console.warn(msg);
            }
        } catch {
            const msg = `FAILURE: Boost of ${amount} sats to ${name}`;
            console.warn(msg);
        }

        return;
    };

    const deleteShow = (showName: string) => {
        const newSubscriptions = subscriptions;

        delete newSubscriptions[showName];
        localStorage.setItem(
            LOCALSTORAGE_SUBSCRIPTION_KEY,
            JSON.stringify(newSubscriptions)
        );
        setSubscriptions(
            JSON.parse(
                localStorage.getItem(LOCALSTORAGE_SUBSCRIPTION_KEY) || ''
            )
        );
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
            try {
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
            } catch {
                const msg = `FAILURE: Payment of ${amountToSend} sats to ${o.name}`;
                console.warn(msg);
                failure = true;
            }
        }

        newSent[o.address] = sent[o.address]
            ? failure
                ? sent[o.address].plus(0)
                : sent[o.address].plus(amountToSend)
            : failure
            ? new BigNumber(0)
            : amountToSend;

        newCarry[o.address] = failure ? amountOwed : amountToCarry;

        console.log(`newSent for ${o.name}: ${newSent[o.address]}`);
        console.log(`newCarry for ${o.name}: ${newCarry[o.address]}`);

        setSent(newSent);
        setCarry(newCarry);

        if (!failure) {
            const total = sentTotal.plus(amountToSend);
            setSentTotal(total);
        }

        return;
    };

    const searchForPodcast = (searchString: string) =>
        searchPodcasts(searchString).then((data: any) =>
            setSearchResults(data)
        );

    const setPodcastSearch = (searchString: string) => {
        setSearch(searchString);
        searchForPodcast(searchString);
    };

    const setFunding = (funding: any) => {
        const newFunding = cloneDeep(funding);
        if (supportEcho && newFunding && newFunding.destinations) {
            newFunding.destinations[0].split =
                newFunding.destinations[0].split - 1;
            newFunding.destinations.push({
                address:
                    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
                name: 'Zeus + Echo Developer Fund',
                type: 'node',
                split: 1
            });
        }
        setActivePodcastFundingUnmodified(funding);
        setActivePodcastFunding(newFunding);
    };

    const setSPM = (newValue: Number) => {
        localStorage.setItem(LOCALSTORAGE_SPM_KEY, newValue.toString());
        setSatsPerMinute(newValue);
    };

    useEffect(() => {
        setFunding(activePodcastFundingUnmodified);
    }, [supportEcho]);

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

    return (
        <Page
            satsPerMinute={satsPerMinute}
            showSettings={showSettings}
            toggleShowSettings={toggleShowSettings}
            setSatsPerMinute={setSPM}
            supportEcho={supportEcho}
            toggleSupportEcho={toggleSupportEcho}
            searchField={searchField}
            setSearchField={setSearchField}
            setPodcastSearch={setPodcastSearch}
            sentTotal={sentTotal}
            showStats={showStats}
            toggleShowStats={toggleShowStats}
        >
            {!lnc.isConnected && (
                <h2 className="text-center">Welcome to Echo</h2>
            )}
            <p className="text-center">
                {lnc.isConnected
                    ? `You are now connected to your Lightning node, ${
                          info && info.alias ? info.alias : info.identityPubkey
                      }`
                    : 'Connect or Login to start listening to podcasts and paying your favorite producers with Bitcoin over the Lightning Network.'}
            </p>
            {!lnc.isConnected && (
                <p className="text-center">
                    Powered by Podcasting 2.0, Lightning Node Connect, and{' '}
                    <a target="_blank" rel="noreferrer">
                        PodcastIndex.org
                    </a>
                    .{' '}
                    <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://value4value.info/"
                    >
                        Learn more.
                    </a>
                </p>
            )}

            {lnc.isConnected && !!search && (
                <>
                    <h4
                        style={{
                            display: 'inline-block'
                        }}
                    >
                        Search results
                    </h4>
                    <p
                        style={{
                            cursor: 'pointer',
                            display: 'inline-block',
                            marginLeft: 10
                        }}
                        onClick={() => {
                            setSearchResults([]);
                            setSearch('');
                        }}
                    >
                        ❌
                    </p>
                    {searchResults.length > 0 &&
                        searchResults.map((o: any, index: number) => {
                            return (
                                <div key={index}>
                                    <p
                                        style={{
                                            cursor: 'pointer',
                                            display: 'inline-block',
                                            backgroundColor: 'darkgreen',
                                            color: 'white',
                                            marginRight: 10,
                                            padding: 8,
                                            borderRadius: 5
                                        }}
                                        onClick={() =>
                                            podcastByFeedId(o.id).then(
                                                (data: any) => {
                                                    subscriptions[o.title] =
                                                        data;

                                                    const sortedSubscriptions =
                                                        Object.keys(
                                                            subscriptions
                                                        )
                                                            .sort()
                                                            .reduce(
                                                                (
                                                                    accumulator: any,
                                                                    key: string
                                                                ) => {
                                                                    accumulator[
                                                                        key
                                                                    ] =
                                                                        subscriptions[
                                                                            key
                                                                        ];

                                                                    return accumulator;
                                                                },
                                                                {}
                                                            );
                                                    localStorage.setItem(
                                                        LOCALSTORAGE_SUBSCRIPTION_KEY,
                                                        JSON.stringify(
                                                            sortedSubscriptions
                                                        )
                                                    );
                                                    setSubscriptions(
                                                        JSON.parse(
                                                            localStorage.getItem(
                                                                LOCALSTORAGE_SUBSCRIPTION_KEY
                                                            ) || ''
                                                        )
                                                    );
                                                    setSearch('');
                                                    setSearchResults([]);
                                                }
                                            )
                                        }
                                    >
                                        + Subscribe
                                    </p>
                                    <p style={{ display: 'inline-block' }}>
                                        {o.title}{' '}
                                        {o.author ? `- ${o.author}` : ''} (
                                        {o.episodeCount})
                                    </p>
                                    {o.image && (
                                        <img
                                            alt={`${o.title} artwork`}
                                            src={o.image}
                                            width={50}
                                            style={{ margin: 20 }}
                                            onError={({ currentTarget }) => {
                                                currentTarget.onerror = null; // prevents looping
                                                currentTarget.src =
                                                    'placeholder.png';
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}

                    {searchResults.length === 0 && (
                        <p>Sorry, no results found.</p>
                    )}
                </>
            )}

            {showStats && (
                <div style={{ marginBottom: 50 }}>
                    {boostRecipient && (
                        <>
                            <h4
                                style={{
                                    marginTop: 25,
                                    display: 'inline-block'
                                }}
                            >
                                Submit a boost to {boostRecipientName}
                            </h4>
                            <p
                                style={{
                                    cursor: 'pointer',
                                    display: 'inline-block',
                                    marginLeft: 10
                                }}
                                onClick={() => setBoostRecipient(null)}
                            >
                                ❌
                            </p>
                            <form
                                onSubmit={(event: any) => {
                                    sendBoost(
                                        boostRecipient,
                                        boostAmount,
                                        boostRecipientName,
                                        boostMessage,
                                        boostSender
                                    );
                                    event.preventDefault();
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    marginBottom: 50
                                }}
                            >
                                <label>
                                    Amount:
                                    <input
                                        type="text"
                                        name="amount"
                                        value={boostAmount}
                                        style={{
                                            marginLeft: 10,
                                            borderRadius: 5
                                        }}
                                        onChange={(event: any) =>
                                            setBoostAmount(
                                                Number(event.target.value)
                                            )
                                        }
                                    />
                                </label>
                                <label>
                                    Boostagram Message (optional):
                                    <input
                                        type="text"
                                        name="message"
                                        value={boostMessage}
                                        style={{
                                            marginLeft: 10,
                                            borderRadius: 5
                                        }}
                                        onChange={(event: any) =>
                                            setBoostMessage(event.target.value)
                                        }
                                    />
                                </label>
                                <label>
                                    Sender name (optional):
                                    <input
                                        type="text"
                                        name="sender"
                                        value={boostSender}
                                        style={{
                                            marginLeft: 10,
                                            borderRadius: 5
                                        }}
                                        onChange={(event: any) =>
                                            setBoostSender(event.target.value)
                                        }
                                        placeholder="An anonymous Echo user"
                                    />
                                </label>
                                <input
                                    type="submit"
                                    value="Submit"
                                    style={{ borderRadius: 5 }}
                                />
                            </form>
                        </>
                    )}
                    <h4
                        style={{
                            display: 'inline-block'
                        }}
                    >
                        Stats
                    </h4>
                    {sentTotal.gt(0) && (
                        <p
                            style={{
                                cursor: 'pointer',
                                display: 'inline-block',
                                marginLeft: 10
                            }}
                            onClick={() => clearStats()}
                        >
                            0️⃣
                        </p>
                    )}
                    {activePodcastFunding && activePodcastFunding.destinations && (
                        <p
                            style={{
                                fontWeight: 'bold',
                                marginTop: 20,
                                fontSize: 20
                            }}
                        >
                            Value4Value recipients
                        </p>
                    )}

                    {activePodcastFunding &&
                        activePodcastFunding.destinations.map(
                            (o: any, index: number) => {
                                return (
                                    <div key={index}>
                                        <p
                                            style={{
                                                display: 'inline-block',
                                                margin: 5
                                            }}
                                        >
                                            {o.name} ({o.split}% |{' '}
                                            {new BigNumber(satsPerMinute)
                                                .multipliedBy(o.split)
                                                .dividedBy(100)
                                                .toString()}{' '}
                                            s/m)
                                        </p>
                                        {sent && sent[o.address] && (
                                            <p
                                                style={{
                                                    display: 'inline-block',
                                                    margin: 5,
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
                                                    display: 'inline-block',
                                                    margin: 5,
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
                                        <p
                                            style={{
                                                display: 'inline-block',
                                                margin: 5,
                                                backgroundColor: 'lightblue',
                                                color: 'white',
                                                padding: 5,
                                                paddingLeft: 10,
                                                paddingRight: 10,
                                                cursor: 'pointer',
                                                borderRadius: 5
                                            }}
                                            onClick={() => {
                                                setBoostRecipient(o.address);
                                                setBoostRecipientName(o.name);
                                            }}
                                        >
                                            BOOST ⚡
                                        </p>
                                    </div>
                                );
                            }
                        )}
                    <div style={{ marginTop: 20 }}>
                        <p
                            style={{
                                display: 'inline-block',
                                fontWeight: 'bold',
                                marginRight: 5
                            }}
                        >
                            Total sent:
                        </p>
                        <p
                            style={{
                                display: 'inline-block',
                                fontWeight: 'bold',
                                color: sentTotal.gt(0) ? 'green' : 'black'
                            }}
                        >
                            {`${sentTotal}`}
                        </p>
                    </div>
                </div>
            )}

            {activePodcast && !activePodcastFunding && (
                <p>This podcast doesn't support Value4Value payments</p>
            )}

            {lnc.isConnected && (
                <>
                    {activePodcast && <h4>Now Playing</h4>}
                    {activePodcast && <h2>{activePodcast.title}</h2>}

                    {activePodcast && (
                        <ReactAudioPlayer
                            src={activePodcast.enclosureUrl}
                            autoPlay
                            controls
                            onListen={async () => {
                                // parallel
                                if (
                                    activePodcastFunding &&
                                    activePodcastFunding.destinations
                                ) {
                                    await activePodcastFunding.destinations.map(
                                        async (o: any) => {
                                            await processPayment(o);
                                        }
                                    );
                                }
                            }}
                            // trigger onListen every minute
                            listenInterval={60_000}
                            style={{
                                width: '100%',
                                marginTop: 25
                            }}
                        />
                    )}

                    {activePodcast && (
                        <div
                            style={{
                                display: 'inline-grid',
                                gridTemplateColumns: '1fr 1fr',
                                marginTop: 50
                            }}
                        >
                            {activePodcast.feedImage && (
                                <img
                                    alt={`${activePodcast.title} artwork`}
                                    src={activePodcast.feedImage}
                                    width={'80%'}
                                    style={{ alignItems: 'center' }}
                                    onError={({ currentTarget }) => {
                                        currentTarget.onerror = null; // prevents looping
                                        currentTarget.src = 'placeholder.png';
                                    }}
                                />
                            )}
                            {activePodcast.description && (
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: activePodcast.description
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {!!subscriptions && (
                        <>
                            <h4
                                style={{
                                    fontWeight: 'bold',
                                    display: 'inline-block',
                                    marginTop: 25
                                }}
                            >
                                Your subscriptions
                            </h4>
                            {Object.keys(subscriptions).length > 0 && (
                                <p
                                    style={{
                                        cursor: 'pointer',
                                        display: 'inline-block',
                                        marginLeft: 10
                                    }}
                                    onClick={() => toggleEditMode(!editMode)}
                                >
                                    ✎
                                </p>
                            )}
                        </>
                    )}
                    {!!subscriptions &&
                    Object.keys(subscriptions).length > 0 ? (
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
                                                cursor: 'pointer',
                                                display: 'inline-block'
                                            }}
                                        >
                                            {`${
                                                selectedShow[0] === showName
                                                    ? '▼'
                                                    : '▶'
                                            } ${showName}`}
                                        </p>
                                        {editMode && (
                                            <p
                                                style={{
                                                    cursor: 'pointer',
                                                    display: 'inline-block',
                                                    marginLeft: 10
                                                }}
                                                onClick={() =>
                                                    deleteShow(showName)
                                                }
                                            >
                                                ❌
                                            </p>
                                        )}
                                        {selectedShow[0] === showName &&
                                            selectedShow[1].image && (
                                                <img
                                                    alt={`${showName} artwork`}
                                                    src={selectedShow[1].image}
                                                    width={400}
                                                    style={{
                                                        display: 'block',
                                                        marginBottom: 20
                                                    }}
                                                />
                                            )}
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
                                                                setFunding(
                                                                    subscriptions[
                                                                        showName
                                                                    ].value
                                                                );
                                                                setActivePodcast(
                                                                    episode
                                                                );
                                                                setActiveShow(
                                                                    selectedShow
                                                                );
                                                                setSearchResults(
                                                                    []
                                                                );
                                                                setBoostRecipient(
                                                                    null
                                                                );
                                                                setBoostRecipientName(
                                                                    ''
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
            <p className="text-center" style={{ marginTop: 50 }}>
                {`v${packageInfo.version}`} |{' '}
                <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://github.com/ZeusLN/echo"
                >
                    GitHub
                </a>
            </p>

            <ToastContainer />
        </Page>
    );
};

export default Home;
