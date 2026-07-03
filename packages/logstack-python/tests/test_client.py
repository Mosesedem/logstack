import logging

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


def test_capture_logging_default_adds_handler():
    # Default should install a handler on root
    client = LogStackClient(api_key="test", flush_interval=60.0, batch_size=100)
    root = logging.getLogger()
    handler_classes = [type(h).__name__ for h in root.handlers]
    assert any("LogStackHandler" in h or "_LogStackHandler" in h for h in handler_classes)
    client.close()


def test_disable_capture_logging():
    client = LogStackClient(api_key="test", capture_logging=False, flush_interval=60.0)
    root = logging.getLogger()
    assert not any(type(h).__name__ == "_LogStackHandler" for h in root.handlers)
    client.close()


def test_capture_logging_forwards_with_source_python_logging():
    client = LogStackClient(api_key="test", flush_interval=60.0, batch_size=100)
    captured_batches = []

    def fake_send(batch):
        captured_batches.append(batch)

    client._send_batch = fake_send  # type: ignore[method-assign]

    app_logger = logging.getLogger("test.app")
    app_logger.info("hello from stdlib logging")

    client.flush()

    assert len(captured_batches) == 1
    entries = captured_batches[0]
    assert len(entries) == 1
    assert entries[0]["message"] == "hello from stdlib logging"
    assert entries[0]["source"] == "python-logging"
    assert entries[0]["level"] == "info"
    client.close()


def test_capture_logging_skips_internal_logstack_logger():
    client = LogStackClient(api_key="test", flush_interval=60.0, batch_size=100)
    captured_batches = []

    def fake_send(batch):
        captured_batches.append(batch)

    client._send_batch = fake_send  # type: ignore[method-assign]

    internal = logging.getLogger("logstack.transport")
    internal.error("internal SDK failure should not loop")

    client.flush()

    assert captured_batches == []
    client.close()