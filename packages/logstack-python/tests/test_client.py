from logstack.client import LogStackClient, normalize_api_url


def test_normalize_api_url():
    assert normalize_api_url("https://api.logstack.tech/") == "https://api.logstack.tech"
    assert normalize_api_url("http://localhost:8080/v1") == "http://localhost:8080"


def test_batch_flush_no_deadlock():
    """Filling the batch must not deadlock by calling flush while holding the lock."""
    client = LogStackClient(api_key="test", batch_size=2, flush_interval=60.0)

    sent = {"count": 0}

    def fake_send(batch):
        sent["count"] += len(batch)

    client._send_batch = fake_send  # type: ignore[method-assign]

    client.info("one")
    client.info("two")  # triggers auto-send at batch_size=2

    assert sent["count"] == 2
    client.close()


def test_close_is_idempotent():
    client = LogStackClient(api_key="test", flush_interval=60.0)
    client.close()
    client.close()