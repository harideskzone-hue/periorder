"""POS connector registry for dynamic adapter lookup."""


from periorder.integrations.base import POSConnector

_REGISTRY: dict[str, type[POSConnector]] = {}


def register_connector(provider_name: str, connector_cls: type[POSConnector]) -> None:
    _REGISTRY[provider_name.lower()] = connector_cls


def _ensure_default_providers() -> None:
    if not _REGISTRY:
        import periorder.integrations.providers  # noqa: F401


def get_connector(provider_name: str) -> POSConnector:
    _ensure_default_providers()
    name = provider_name.lower()
    if name not in _REGISTRY:
        raise ValueError(
            f"Unsupported POS provider: '{provider_name}'. Registered providers: {list(_REGISTRY.keys())}"
        )
    return _REGISTRY[name]()


def list_available_providers() -> list[str]:
    _ensure_default_providers()
    return sorted(_REGISTRY.keys())
