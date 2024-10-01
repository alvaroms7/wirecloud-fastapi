# -*- coding: utf-8 -*-

# Copyright (c) 2012-2016 CoNWeT Lab., Universidad Politécnica de Madrid

# This file is part of Wirecloud.

# Wirecloud is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# Wirecloud is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with Wirecloud.  If not, see <http://www.gnu.org/licenses/>.


from fastapi import APIRouter

from src.wirecloud.commons.utils.http import produces, authentication_required, consumes
from src.wirecloud.platform.workspace.crud import get_workspace_list
from src.wirecloud.commons.auth.utils import UserDep
from src.wirecloud.platform.workspace.schemas import WorkspaceData
from src.wirecloud.database import DBDep
from src.wirecloud.platform.workspace.utils import get_workspace_data

workspace_router = APIRouter()


@workspace_router.get(
    "/",
    summary="Get Workspace List",
    description="Retrieve a list of workspaces for the authenticated user",
    response_model=list[WorkspaceData],
    responses={
        200: {"description": "List of workspaces"},
        401: {"description": "Authentication required"}
    }
)
@produces(["application/json"])
@authentication_required
async def get_workspace_list_route(db: DBDep, user: UserDep):
    workspaces = await get_workspace_list(db, user)
    data_list = [await get_workspace_data(workspace, user) for workspace in workspaces]

    return data_list
