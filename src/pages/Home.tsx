import React, { useEffect, useState } from 'react';
import Page from '../components/Page';
import useLNC from '../hooks/useLNC';
import BigNumber from 'bignumber.js';
import Parser from 'rss-parser';
import ReactAudioPlayer from 'react-audio-player';
import { sha256 } from 'js-sha256';

const randomBytes = require('randombytes');

const parser = new Parser({
    customFields: {
        feed: ['podcast:value']
    }
});

const parse = async (rss: string) => {
    const episodes: any = [];
    const recipients: any = [];
    // TODO configure CORS proxy to only be used in dev
    const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
    let feed = await parser.parseURL(CORS_PROXY + rss);

    feed['podcast:value']['podcast:valueRecipient'].forEach((item: any) => {
        const entry = item['$'];
        recipients.push(entry);
    });

    feed.items.forEach((item) => {
        episodes.push({
            title: item.title,
            mp3: (item.enclosure && item.enclosure.url) || null,
            link: item.link,
            recipients
        });
    });

    return { episodes, recipients };
};

// BASE64 Utils

const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const btoa = (input = '') => {
    const str = input;
    let output = '';

    for (
        let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || ((map = '='), i % 1);
        output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
    ) {
        charCode = str.charCodeAt((i += 3 / 4));

        if (charCode > 0xff) {
            throw new Error(
                "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
            );
        }

        block = (block << 8) | charCode;
    }

    return output;
};

const hexStringToByte = (str: string) => {
    if (!str) {
        return new Uint8Array();
    }

    const a = [];
    for (let i = 0, len = str.length; i < len; i += 2) {
        a.push(parseInt(str.substr(i, 2), 16));
    }

    return new Uint8Array(a);
};

const byteToBase64 = (buffer: Uint8Array) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const hexToBase64 = (str: string) => byteToBase64(hexStringToByte(str));

//

const Home: React.FC = () => {
    const { lnc } = useLNC();
    const [info, setInfo] = useState<any>();

    const [noAgenda, setNA]: [any, any] = useState({});
    const [moeFactz, setMF]: [any, any] = useState({});
    //
    const [satsPerMinute, setSatsPerMinute]: [any, any] = useState(5);
    const [activePodcast, setActivePodcast]: [any, any] = useState(null);
    // keep track of sent, and to send - can't keysend millisats
    const [sent, setSent]: [any, any] = useState({});
    const [carry, setCarry]: [any, any] = useState({});

    // fetch episodes here
    (async () => {
        if (!noAgenda.episodes) {
            const noAgenda: any = await parse(
                'http://feed.nashownotes.com/rss.xml'
            );
            setNA(noAgenda);
        }

        if (!moeFactz.episodes) {
            const moeFactz: any = await parse(
                'https://feed.nashownotes.com/mfrss.xml'
            );
            setMF(moeFactz);
        }
    })();

    const keysend = async (destination: string, amount: number) => {
        const preimage = randomBytes(32);
        const secret = preimage.toString('base64');
        const paymentHash = hexToBase64(sha256(preimage));
        const destCustomRecords = { '5482373484': secret };
        const info = await lnc.lnd.lightning.sendPaymentSync({
            dest: hexToBase64(destination),
            amt: amount.toString(),
            destCustomRecords,
            paymentHash
        });
        console.log(info);
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
            const result = await keysend(o.address, amountToSend.toNumber());
            if (!!result.paymentRoute) {
                console.info(
                    `SUCCESS: Payment of ${amountToSend} to ${o.name}`
                );
            } else {
                console.warn(
                    `FAILURE: Payment of ${amountToSend} to ${o.name}`
                );
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

    // const testSend = async () => {
    //     console.log('testSend');
    //     await keysend(
    //         // AMBOSS
    //         '03006fcf3312dae8d068ea297f58e2bd00ec1ffe214b793eda46966b6294a53ce6',
    //         10
    //     );
    // };

    useEffect(() => {
        if (lnc.isConnected) {
            const sendRequest = async () => {
                const res = await lnc.lnd.lightning.getInfo();
                setInfo(res);
            };
            sendRequest();
        }
    }, [lnc.isConnected, lnc.lnd.lightning]);

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
                            src={activePodcast.mp3}
                            autoPlay
                            controls
                            onListen={async () => {
                                // parallel
                                // await activePodcast.recipients.map(async (o: any) => {
                                //     await processPayment(o);
                                // });

                                // series
                                for (const recipient of activePodcast.recipients) {
                                    console.log(
                                        '! Starting processing of payment to',
                                        recipient.name
                                    );
                                    await processPayment(recipient);
                                }
                                return;
                            }}
                            // trigger onListen every minute
                            // listenInterval={60000}
                            listenInterval={15000}
                        />
                    )}
                    {activePodcast &&
                        activePodcast.recipients &&
                        activePodcast.recipients.map((o: any) => {
                            return (
                                <>
                                    <p style={{ fontWeight: 'bold' }}>
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
                                                ? carry[o.address].toString()
                                                : '0'}
                                        </p>
                                    )}
                                </>
                            );
                        })}
                    <h2>No Agenda</h2>
                    {!!noAgenda.episodes &&
                        noAgenda.episodes.map((o: any) => {
                            return (
                                <>
                                    <p
                                        key={o.title}
                                        onClick={() => setActivePodcast(o)}
                                    >
                                        ▶️ {o.title}
                                    </p>
                                </>
                            );
                        })}
                    <h2>Moe Factz</h2>
                    {!!moeFactz.episodes &&
                        moeFactz.episodes.map((o: any) => {
                            return (
                                <>
                                    <p
                                        key={o.title}
                                        onClick={() => setActivePodcast(o)}
                                    >
                                        ▶️ {o.title}
                                    </p>
                                </>
                            );
                        })}
                </>
            )}
        </Page>
    );
};

export default Home;
