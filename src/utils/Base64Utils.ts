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

const atob = (input = '') => {
    const str = input.replace(/=+$/, '');
    let output = '';

    if (str.length % 4 === 1) {
        throw new Error(
            "'atob' failed: The string to be decoded is not correctly encoded."
        );
    }
    for (
        let bc = 0, bs = 0, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
            ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
            : 0
    ) {
        buffer = chars.indexOf(buffer);
    }

    return output;
};

const hexStringToByte = (str = '') => {
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

const hexToBase64 = (str = '') => byteToBase64(hexStringToByte(str));

const stringToUint8Array = (str: string) =>
    Uint8Array.from(str, (x) => x.charCodeAt(0));

const hexToUint8Array = (hexString: string) =>
    new Uint8Array(
        hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

const bytesToHexString = (bytes: any) =>
    bytes.reduce(
        (memo: any, i: number) => memo + ('0' + i.toString(16)).slice(-2),
        ''
    );

const utf8ToHexString = (hexString: string) =>
    Buffer.from(hexString, 'utf8').toString('hex');

export {
    btoa,
    atob,
    hexStringToByte,
    byteToBase64,
    hexToBase64,
    stringToUint8Array,
    hexToUint8Array,
    bytesToHexString,
    utf8ToHexString
};
