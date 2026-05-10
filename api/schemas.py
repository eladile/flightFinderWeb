"""
Pydantic v2 schemas for the flight search API.

Wire format convention:
- All models use camelCase field names in JSON/SSE (e.g., "flightCount", "jobId")
- Python code uses snake_case internally (e.g., flight_count, job_id)
- Serialization: use .model_dump(by_alias=True) or .model_dump_json(by_alias=True)
- Deserialization: models accept both camelCase and snake_case via populate_by_name=True

Example:
    flight = Flight(destination="BER", airline="LH", ...)
    json_str = flight.model_dump_json(by_alias=True)  # produces camelCase keys
"""

from datetime import date, datetime
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    """Base schema with shared configuration for camelCase wire format."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class Flight(BaseSchema):
    """
    Flight result matching the config.Flight dataclass.
    All 18 fields with identical names, types, and defaults.
    """

    destination: str
    airline: str
    departure_time: str
    arrival_time: str
    duration: str
    price: str
    date: str
    stops: str = "Nonstop"
    return_departure: str = ""
    return_arrival: str = ""
    link: str = ""
    source: str = ""
    layover_info: str = ""
    return_date: str = ""
    price_type: str = ""
    return_airline: str = ""
    return_duration: str = ""
    return_stops: str = ""


class SearchRequest(BaseSchema):
    """
    Search request from the client.
    Validates IATA codes, date ranges, trip-type-specific requirements, and stops.
    """

    origins: list[str]
    destinations: list[str]
    trip_type: Literal["oneway", "roundtrip"]
    outbound_date_from: date
    outbound_date_to: date
    return_date_from: date | None = None
    return_date_to: date | None = None
    stops: Literal["any", "nonstop"] | int
    providers: list[str] = Field(default_factory=lambda: ["google", "skyscanner"])

    @field_validator("origins", "destinations")
    @classmethod
    def validate_iata_codes(cls, codes: list[str]) -> list[str]:
        """Ensure each code is exactly 3 uppercase A-Z characters."""
        if not codes:
            raise ValueError("Must provide at least one code")
        for code in codes:
            if len(code) != 3 or not code.isupper() or not code.isalpha():
                raise ValueError(f"Invalid IATA code '{code}': must be 3 uppercase letters")
        return codes

    @field_validator("stops")
    @classmethod
    def validate_stops(cls, value: Literal["any", "nonstop"] | int) -> Literal["any", "nonstop"] | int:
        """Ensure integer stops are non-negative."""
        if isinstance(value, int) and value < 0:
            raise ValueError("stops must be non-negative when specified as an integer")
        return value

    @field_validator("providers")
    @classmethod
    def validate_providers(cls, providers: list[str]) -> list[str]:
        """Ensure at least one provider is specified."""
        if not providers:
            raise ValueError("Must provide at least one provider")
        return providers

    @model_validator(mode="after")
    def validate_date_ranges(self) -> "SearchRequest":
        """Validate outbound and return date range consistency."""
        # Outbound date range
        if self.outbound_date_to < self.outbound_date_from:
            raise ValueError("outbound_date_to must be >= outbound_date_from")

        # Return date requirements based on trip type
        if self.trip_type == "roundtrip":
            if self.return_date_from is None or self.return_date_to is None:
                raise ValueError("return_date_from and return_date_to are required for roundtrip")
            if self.return_date_to < self.return_date_from:
                raise ValueError("return_date_to must be >= return_date_from")
        else:  # oneway
            if self.return_date_from is not None or self.return_date_to is not None:
                raise ValueError("return_date_from and return_date_to must be None for oneway")

        return self


class SearchJob(BaseSchema):
    """A single search job representing one origin-destination-date combination."""

    id: str
    origin: str
    destination: str
    outbound_date: date
    return_date: date | None = None
    stops: Literal["any", "nonstop"] | int
    providers: list[str]

    @field_validator("origin", "destination")
    @classmethod
    def validate_iata_code(cls, code: str) -> str:
        """Ensure code is exactly 3 uppercase A-Z characters."""
        if len(code) != 3 or not code.isupper() or not code.isalpha():
            raise ValueError(f"Invalid IATA code '{code}': must be 3 uppercase letters")
        return code


class PlanEvent(BaseSchema):
    """SSE event announcing the search plan with all jobs."""

    type: Literal["plan"] = "plan"
    total_jobs: int
    jobs: list[SearchJob]


class JobStartedEvent(BaseSchema):
    """SSE event announcing a job has started."""

    type: Literal["job_started"] = "job_started"
    job_id: str


class JobCompletedEvent(BaseSchema):
    """SSE event announcing a job has completed successfully."""

    type: Literal["job_completed"] = "job_completed"
    job_id: str
    flight_count: int


class JobFailedEvent(BaseSchema):
    """SSE event announcing a job has failed."""

    type: Literal["job_failed"] = "job_failed"
    job_id: str
    error: str


class FlightEvent(BaseSchema):
    """SSE event announcing a single flight result."""

    type: Literal["flight"] = "flight"
    job_id: str
    flight: Flight


class DoneEvent(BaseSchema):
    """SSE event announcing the search is complete."""

    type: Literal["done"] = "done"
    total_flights: int
    failed_jobs: int


# Union type for SSE event discrimination
SSEEvent = Annotated[
    PlanEvent | JobStartedEvent | JobCompletedEvent | JobFailedEvent | FlightEvent | DoneEvent,
    Field(discriminator="type"),
]


# --- Scheduled Searches Models ---

class ScheduleRun(BaseSchema):
    """A single execution record of a scheduled search."""

    started_at: datetime
    finished_at: datetime | None = None
    status: Literal["success", "failed", "running"]
    flight_count: int = 0
    error: str | None = None


class Schedule(BaseSchema):
    """A scheduled search definition."""

    name: str
    cron_expression: str
    request: SearchRequest
    recipients: list[str] = Field(default_factory=list)
    subject: str | None = None
    enabled: bool = True
    created_at: datetime
    last_run: ScheduleRun | None = None
    runs: list[ScheduleRun] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Ensure name is a valid slug: lowercase alphanum + dashes, 1-64 chars."""
        import re
        if not re.match(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$", v):
            raise ValueError(
                "name must be lowercase alphanumeric with optional dashes, 1-64 chars"
            )
        return v

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        """Ensure cron expression is valid."""
        from croniter import croniter
        if not croniter.is_valid(v):
            raise ValueError(f"invalid cron expression: {v}")
        return v


class CreateScheduleRequest(BaseSchema):
    """Request to create a new schedule."""

    name: str
    cron_expression: str
    request: SearchRequest
    recipients: list[str] = Field(default_factory=list)
    subject: str | None = None
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Ensure name is a valid slug."""
        import re
        if not re.match(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$", v):
            raise ValueError(
                "name must be lowercase alphanumeric with optional dashes, 1-64 chars"
            )
        return v

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        """Ensure cron expression is valid."""
        from croniter import croniter
        if not croniter.is_valid(v):
            raise ValueError(f"invalid cron expression: {v}")
        return v


class UpdateScheduleRequest(BaseSchema):
    """Request to update an existing schedule (all fields optional)."""

    name: str | None = None
    cron_expression: str | None = None
    request: SearchRequest | None = None
    recipients: list[str] | None = None
    subject: str | None = None
    enabled: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        """Ensure name is a valid slug if provided."""
        if v is None:
            return v
        import re
        if not re.match(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$", v):
            raise ValueError(
                "name must be lowercase alphanumeric with optional dashes, 1-64 chars"
            )
        return v

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str | None) -> str | None:
        """Ensure cron expression is valid if provided."""
        if v is None:
            return v
        from croniter import croniter
        if not croniter.is_valid(v):
            raise ValueError(f"invalid cron expression: {v}")
        return v

    @model_validator(mode="after")
    def ensure_at_least_one_field(self) -> "UpdateScheduleRequest":
        """Ensure at least one field is set."""
        if all(
            getattr(self, field) is None
            for field in ["name", "cron_expression", "request", "recipients", "subject", "enabled"]
        ):
            raise ValueError("at least one field must be provided")
        return self
