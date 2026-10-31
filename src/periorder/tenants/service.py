"""Tenant and store management service enforcing data isolation."""


from periorder.tenants.models import Store, Tenant, User, UserRole


class TenantService:
    """In-memory multi-tenant store manager supporting tenant-isolated queries."""

    def __init__(self) -> None:
        self._tenants: dict[str, Tenant] = {}
        self._stores: dict[str, Store] = {}
        self._users: dict[str, User] = {}
        self._seed_default_tenant()

    def _seed_default_tenant(self) -> None:
        """Seed default demonstration tenant and stores."""
        t = Tenant(tenant_id="tenant_default", business_name="Metro Fresh Supermarkets")
        self._tenants[t.tenant_id] = t

        s1 = Store(
            store_id="CA_1",
            tenant_id="tenant_default",
            store_name="Downtown Central (CA_1)",
            location="Los Angeles, CA",
            pos_connected=True,
            pos_provider="generic_mock",
        )
        s2 = Store(
            store_id="TX_1",
            tenant_id="tenant_default",
            store_name="Eastside Market (TX_1)",
            location="Dallas, TX",
            pos_connected=False,
        )
        s3 = Store(
            store_id="WI_3",
            tenant_id="tenant_default",
            store_name="Northside Grocery (WI_3)",
            location="Milwaukee, WI",
            pos_connected=False,
        )
        self._stores[s1.store_id] = s1
        self._stores[s2.store_id] = s2
        self._stores[s3.store_id] = s3

        u = User(
            user_id="user_admin",
            tenant_id="tenant_default",
            email="manager@metrofresh.com",
            name="Store General Manager",
            role=UserRole.STORE_MANAGER,
        )
        self._users[u.user_id] = u

    def get_tenant(self, tenant_id: str) -> Tenant | None:
        return self._tenants.get(tenant_id)

    def list_stores_for_tenant(self, tenant_id: str) -> list[Store]:
        """Returns stores strictly matching tenant_id (tenant isolation)."""
        return [s for s in self._stores.values() if s.tenant_id == tenant_id]

    def get_store(self, tenant_id: str, store_id: str) -> Store | None:
        """Returns store if and only if it belongs to tenant_id."""
        store = self._stores.get(store_id)
        if store and store.tenant_id == tenant_id:
            return store
        return None

    def register_tenant(self, business_name: str) -> Tenant:
        import uuid
        tenant_id = f"tenant_{uuid.uuid4().hex[:8]}"
        t = Tenant(tenant_id=tenant_id, business_name=business_name)
        self._tenants[tenant_id] = t
        return t

    def add_store(self, tenant_id: str, store_name: str, location: str, store_id: str | None = None) -> Store:
        if tenant_id not in self._tenants:
            raise ValueError(f"Tenant {tenant_id} does not exist.")
        if not store_id:
            import uuid
            store_id = f"store_{uuid.uuid4().hex[:8]}"
        s = Store(store_id=store_id, tenant_id=tenant_id, store_name=store_name, location=location)
        self._stores[store_id] = s
        return s

    def update_pos_connection(self, tenant_id: str, store_id: str, provider: str, connected: bool = True) -> Store:
        store = self.get_store(tenant_id, store_id)
        if not store:
            raise PermissionError(f"Access denied: Store {store_id} not found for tenant {tenant_id}.")
        store.pos_connected = connected
        store.pos_provider = provider if connected else None
        return store
