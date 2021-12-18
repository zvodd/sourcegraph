module Pages.UseCaseFindReplace exposing (Model, Msg, page)

import Effect exposing (Effect)
import Element exposing (..)
import Gen.Params.UseCaseCodeOwnershipAuthor exposing (Params)
import Gen.Params.UseCaseCodeOwnershipTopical exposing (Params)
import Page
import Pages.UseCaseBase exposing (Msg(..))
import Process
import Request
import Shared exposing (Msg)
import Styling exposing (..)
import Task
import Types exposing (..)
import View exposing (View)



-- INIT


init : ( Model, Effect Msg )
init =
    let
        ( model, _ ) =
            Pages.UseCaseBase.init

        findValue =
            ""

        replaceValue =
            ""
    in
    ( { model
        | title = "Find and replace code"
        , description = "Regexp or Structural find and replace"
        , query = "repo:sourcegraph/sourcegraph$ -file:test content:replace.structural(" ++ findValue ++ " -> " ++ replaceValue ++ ") " ++ "patterntype:structural"
        , genericInput1 = findValue
        , genericInput2 = replaceValue
        , visualKind = Patch
        , supportedVisualKinds = [ Patch ]
      }
    , Effect.none
    )


page : Shared.Model -> Request.With Params -> Page.With Model Msg
page _ _ =
    Page.advanced
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }



-- MODEL


type alias Model =
    Pages.UseCaseBase.Model



-- UPDATE


type alias Msg =
    Pages.UseCaseBase.Msg


update : Msg -> Model -> ( Model, Effect Msg )
update msg model =
    let
        debounceQueryMillis =
            400
    in
    case msg of
        OnGenericInput1 genericInput1 ->
            let
                findValue =
                    genericInput1

                replaceValue =
                    model.genericInput2
            in
            ( { model
                | genericInput1 = genericInput1
                , query = "repo:sourcegraph/sourcegraph$ -file:test content:replace.structural(" ++ findValue ++ " -> " ++ replaceValue ++ ") " ++ "patterntype:structural"
                , debounce = model.debounce + 1
                , queryModifiedSinceLastRequest = True
              }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        OnGenericInput2 genericInput2 ->
            let
                findValue =
                    model.genericInput1

                replaceValue =
                    genericInput2
            in
            ( { model
                | genericInput2 = genericInput2
                , query = "repo:sourcegraph/sourcegraph$ -file:test content:replace.structural(" ++ findValue ++ " -> " ++ replaceValue ++ ") " ++ "patterntype:structural"
                , debounce = model.debounce + 1
                , queryModifiedSinceLastRequest = True
              }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        _ ->
            Pages.UseCaseBase.update msg model



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions =
    Pages.UseCaseBase.subscriptions



-- VIEW


view : Model -> View Msg
view model =
    Pages.UseCaseBase.view model "authors" "time frame"
