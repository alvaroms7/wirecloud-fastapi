from datetime import datetime

from pydantic import BaseModel

from src.wirecloud.database import Id


class Workspace(BaseModel):
    pass

    def is_editable_by(self, user):
        return user.is_superuser or self.creator == user

    def is_shared(self):
        return self.public or self.users.count() > 1 or self.groups.count() > 1


class WorkspaceData(BaseModel):
    id: Id
    name: str
    title: str
    public: bool
    shared: bool
    requireauth: bool
    owner: Id
    removable: bool
    lastmodified: datetime
    description: str
    longdescription: str
