from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http
from sqlalchemy import func, or_, select

from ..deps import DB, Admin, CurrentUser, Manager
from ..models import Client
from ..schemas import ClientCreate, ClientOut, ClientUpdate
from ..services.serializers import clients_out

router = APIRouter(prefix="/clients", tags=["clients"])


def _get(db: DB, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Client not found.")
    return client


def _check_unique(db: DB, name: str, exclude_id: int | None = None) -> None:
    stmt = select(Client.id).where(func.lower(Client.name) == name.lower())
    if exclude_id:
        stmt = stmt.where(Client.id != exclude_id)
    if db.scalar(stmt):
        raise HTTPException(http.HTTP_409_CONFLICT, "A client with this name already exists.")


@router.get("", response_model=list[ClientOut])
def list_clients(_: CurrentUser, db: DB, q: str | None = None, status: str | None = Query(default=None)):
    stmt = select(Client).order_by(Client.name)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Client.name).like(like),
                func.lower(Client.industry).like(like),
                func.lower(Client.contact_person).like(like),
                func.lower(Client.location).like(like),
            )
        )
    if status:
        stmt = stmt.where(Client.status == status)
    return clients_out(db, db.scalars(stmt))


@router.post("", response_model=ClientOut, status_code=201)
def create_client(body: ClientCreate, user: Manager, db: DB):
    _check_unique(db, body.name)
    client = Client(**body.model_dump(), created_by_id=user.id)
    db.add(client)
    db.commit()
    return clients_out(db, [client])[0]


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, _: CurrentUser, db: DB):
    return clients_out(db, [_get(db, client_id)])[0]


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, _: Manager, db: DB):
    client = _get(db, client_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("name"):
        _check_unique(db, data["name"], client.id)
    for key, value in data.items():
        if value is None and key in ("name", "status"):
            continue
        setattr(client, key, value)
    db.commit()
    return clients_out(db, [client])[0]


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, _: Admin, db: DB):
    db.delete(_get(db, client_id))
    db.commit()
