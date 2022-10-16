import React from 'react';
import { Button, Col, Container, Nav, Navbar, Row } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { Link } from 'react-router-dom';
import useLNC from '../hooks/useLNC';
import zeus from '../zeus-logo.svg';

interface Props {
    children?: React.ReactNode;
    satsPerMinute?: string;
    supportEcho?: boolean;
    showSettings?: boolean;
    toggleShowSettings?: any;
    setSatsPerMinute?: any;
    toggleSupportEcho?: any;
    search?: string;
    setSearch?: any;
    searchForPodcast?: any;
    sentTotal?: Number;
    showStats?: boolean;
    toggleShowStats?: any;
}

const Page: React.FC<Props> = ({
    children,
    satsPerMinute,
    showSettings,
    toggleShowSettings,
    setSatsPerMinute,
    supportEcho,
    toggleSupportEcho,
    search,
    setSearch,
    searchForPodcast,
    sentTotal = 0,
    showStats,
    toggleShowStats
}) => {
    const { lnc } = useLNC();
    return (
        <>
            <Navbar bg="dark" variant="dark" expand="lg" className="mb-3">
                <Container>
                    <Link to="/" className="navbar-brand">
                        Echo
                    </Link>
                    <Navbar.Text>by</Navbar.Text>
                    <a
                        href="http://zeusln.app"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <img
                            alt="Zeus"
                            src={zeus}
                            width="70"
                            className="d-inline-block"
                            style={{ marginLeft: 15 }}
                        />{' '}
                    </a>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="ml-auto">
                            <div style={{ marginRight: 20 }}>
                                {lnc.isConnected && (
                                    <Button
                                        style={{
                                            background: 'green',
                                            color: 'white',
                                            borderWidth: 0,
                                            fontWeight: 'bold'
                                        }}
                                        onClick={() =>
                                            toggleShowStats(!showStats)
                                        }
                                    >
                                        {sentTotal.toString()}
                                    </Button>
                                )}
                            </div>
                            <div style={{ marginRight: 20 }}>
                                {lnc.isConnected && (
                                    <Button
                                        style={{
                                            background: showSettings
                                                ? 'black'
                                                : 'orange',
                                            color: 'white',
                                            borderWidth: 0,
                                            fontWeight: 'bold'
                                        }}
                                        onClick={() =>
                                            toggleShowSettings(!showSettings)
                                        }
                                    >
                                        {showSettings
                                            ? 'Close settings'
                                            : satsPerMinute}
                                    </Button>
                                )}
                            </div>
                            {lnc.isConnected && (
                                <Form
                                    className="d-flex"
                                    onSubmit={(event: any) => {
                                        searchForPodcast(search);
                                        event.preventDefault();
                                    }}
                                >
                                    <Form.Control
                                        type="search"
                                        placeholder="Search for a podcast"
                                        className="me-2"
                                        aria-label="Search"
                                        value={search}
                                        onChange={(event: any) =>
                                            setSearch(event.target.value)
                                        }
                                    />
                                    <Button
                                        variant="outline-success"
                                        style={{ marginRight: 15 }}
                                        onClick={() => searchForPodcast(search)}
                                    >
                                        Search
                                    </Button>
                                </Form>
                            )}
                            {lnc.isConnected ? (
                                <a href="/">
                                    <Button
                                        style={{
                                            background: 'darkred',
                                            borderWidth: 0
                                        }}
                                    >
                                        Logout
                                    </Button>
                                </a>
                            ) : lnc.credentials.isPaired ? (
                                <Link to="/login">
                                    <Button>Login</Button>
                                </Link>
                            ) : (
                                <Link to="/connect">
                                    <Button>Connect</Button>
                                </Link>
                            )}
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            {showSettings && (
                <Navbar
                    bg="dark"
                    variant="dark"
                    expand="lg"
                    style={{ marginTop: -18 }}
                >
                    <Container>
                        <Form
                            style={{ width: 75, marginRight: 10 }}
                            onSubmit={(event: any) => {
                                toggleShowSettings(false);
                                event.preventDefault();
                            }}
                        >
                            <Form.Control
                                className="me-2"
                                aria-label="Sats Per Minute"
                                style={{
                                    background: 'orange',
                                    color: 'white',
                                    borderWidth: 0,
                                    fontWeight: 'bold',
                                    marginRight: 10
                                }}
                                value={satsPerMinute}
                                onChange={(event: any) =>
                                    setSatsPerMinute(event.target.value)
                                }
                            />
                        </Form>
                        <Navbar.Text>sats per minute</Navbar.Text>

                        <Navbar.Collapse id="basic-navbar-nav">
                            <Nav className="ml-auto">
                                <Navbar.Text>
                                    Support Echo development by sending Zeus 1%
                                </Navbar.Text>
                                <Button
                                    style={{
                                        background: supportEcho
                                            ? 'green'
                                            : 'red',
                                        color: 'white',
                                        borderWidth: 0,
                                        fontWeight: 'bold',
                                        marginLeft: 10
                                    }}
                                    onClick={() =>
                                        toggleSupportEcho(!supportEcho)
                                    }
                                >
                                    {supportEcho ? 'Enabled' : 'Disabled'}
                                </Button>
                            </Nav>
                        </Navbar.Collapse>
                    </Container>
                </Navbar>
            )}

            <Container>
                <Row>
                    <Col>{children}</Col>
                </Row>
            </Container>
        </>
    );
};

export default Page;
