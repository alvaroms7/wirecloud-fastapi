from src.wirecloud.platform.workspace.schemas import WorkspaceData
from src.wirecloud.commons.auth.schemas import User
from wirecloud.platform.workspace.schemas import Workspace


def get_workspace_data(workspace: Workspace, user: User) -> WorkspaceData:
    longdescription = workspace.longdescription
    if longdescription != '':
        longdescription = clean_html(markdown.markdown(longdescription, output_format='xhtml5'))
    else:
        longdescription = workspace.description

    return WorkspaceData(
        id=str(workspace.id),
        name=workspace.name,
        title=workspace.title,
        public=workspace.public,
        shared=workspace.is_shared(),
        requireauth=workspace.requireauth,
        owner=workspace.users.id,
        removable=workspace.is_editable_by(user),
        lastmodified=workspace.last_modified,
        description=workspace.description,
        longdescription=longdescription,
    )
