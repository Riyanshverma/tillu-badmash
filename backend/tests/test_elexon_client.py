from datetime import date

import httpx
import pytest


async def test_daily_requests_use_correct_endpoints_filters_and_timeouts():
    from app.clients.elexon import ElexonClient

    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=[{"example": 1}])

    async with httpx.AsyncClient(
        base_url="https://elexon.test/bmrs/api/v1/",
        transport=httpx.MockTransport(handler),
    ) as http:
        client = ElexonClient(http)
        assert await client.fuelhh(date(2026, 1, 15)) == [{"example": 1}]
        assert await client.windfor(date(2026, 1, 15)) == [{"example": 1}]
    assert requests[0].url.path == "/bmrs/api/v1/datasets/FUELHH/stream"
    assert dict(requests[0].url.params) == {
        "settlementDateFrom": "2026-01-15", "settlementDateTo": "2026-01-15",
        "fuelType": "WIND",
    }
    assert requests[1].url.path == "/bmrs/api/v1/datasets/WINDFOR/stream"
    assert dict(requests[1].url.params) == {
        "publishDateTimeFrom": "2026-01-15T00:00:00Z",
        "publishDateTimeTo": "2026-01-15T23:59:59.999999Z",
    }
    assert requests[0].extensions["timeout"]["connect"] == 10
    assert requests[0].extensions["timeout"]["read"] == 30


async def test_empty_array_is_success():
    from app.clients.elexon import ElexonClient

    async with httpx.AsyncClient(
        base_url="https://elexon.test/",
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=[])),
    ) as http:
        assert await ElexonClient(http).fuelhh(date(2026, 1, 15)) == []


@pytest.mark.parametrize("status", [400, 401, 404])
async def test_nontransient_http_errors_are_not_retried(status):
    from app.clients.elexon import ElexonClient

    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, json={"detail": "invalid request"})

    async with httpx.AsyncClient(
        base_url="https://elexon.test/", transport=httpx.MockTransport(handler)
    ) as http:
        with pytest.raises(httpx.HTTPStatusError) as error:
            await ElexonClient(http).windfor(date(2026, 1, 15))
    assert error.value.response.status_code == status
    assert len(calls) == 1


@pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
@pytest.mark.parametrize("recovers", [False, True])
async def test_transient_http_retries_are_bounded(status, recovers, monkeypatch):
    from app.clients import elexon

    async def no_wait(_):
        pass

    monkeypatch.setattr(elexon.asyncio, "sleep", no_wait)
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200 if recovers and len(calls) == 3 else status, json=[])

    async with httpx.AsyncClient(
        base_url="https://elexon.test/", transport=httpx.MockTransport(handler)
    ) as http:
        client = elexon.ElexonClient(http)
        if recovers:
            assert await client.windfor(date(2026, 1, 15)) == []
        else:
            with pytest.raises(httpx.HTTPStatusError):
                await client.windfor(date(2026, 1, 15))
    assert len(calls) == 3


@pytest.mark.parametrize("body", [b"not json", b'{"data": []}'])
async def test_invalid_payload_fails_without_retry(body):
    from app.clients.elexon import ElexonClient

    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, content=body)

    async with httpx.AsyncClient(
        base_url="https://elexon.test/", transport=httpx.MockTransport(handler)
    ) as http:
        with pytest.raises(ValueError, match="Elexon"):
            await ElexonClient(http).windfor(date(2026, 1, 15))
    assert len(calls) == 1


async def test_network_timeout_retries_are_bounded(monkeypatch):
    from app.clients import elexon

    async def no_wait(_):
        pass

    monkeypatch.setattr(elexon.asyncio, "sleep", no_wait)
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("upstream timed out", request=request)

    async with httpx.AsyncClient(
        base_url="https://elexon.test/", transport=httpx.MockTransport(handler)
    ) as http:
        with pytest.raises(httpx.ReadTimeout):
            await elexon.ElexonClient(http).fuelhh(date(2026, 1, 15))
    assert len(calls) == 3
