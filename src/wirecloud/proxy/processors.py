# -*- coding: utf-8 -*-

# Copyright (c) 2011-2017 CoNWeT Lab., Universidad Politécnica de Madrid

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

import re


WIRECLOUD_SECURE_DATA_HEADER = 'x-wirecloud-secure-data'

VAR_REF_RE = re.compile(r'^((?P<constant>c)/)?(?P<var_name>.+)$', re.S)


# TODO Implement SecureDataProcessor
class SecureDataProcessor:
    pass